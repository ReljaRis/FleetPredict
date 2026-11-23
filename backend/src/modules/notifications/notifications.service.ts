import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../../config/env.js'
import { prisma } from '../../lib/prisma.js'
import { daysLeft, reachedThreshold } from '../documents/status.js'
import { COMPONENTS } from '../engine/config.js'
import { isoDay } from '../../lib/validation.js'

/**
 * Notification channels stored on each row:
 *   IN_APP               shown in the app only (email switched off for the company)
 *   EMAIL_SENT           also emailed
 *   EMAIL_FAILED         email was attempted and failed
 *   EMAIL_NOT_CONFIGURED the company wants email but no SMTP settings exist on this server, so it is only in the app
 *   EMAIL_PENDING        transient: created and waiting for delivery
 */
export const emailConfigured = () => Boolean(env.SMTP_HOST && env.SMTP_FROM)

let transport: Transporter | null = null
function mailer() {
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
  return transport
}

async function sendEmail(to: string[], subject: string, text: string): Promise<boolean> {
  if (!to.length) return false
  try {
    await mailer().sendMail({ from: env.SMTP_FROM, to: to.join(', '), subject, text })
    return true
  } catch (e) {
    console.error('Email delivery failed:', (e as Error).message)
    return false
  }
}

/** Owners and managers receive document notifications. */
async function recipients(companyId: string) {
  const users = await prisma.user.findMany({ where: { companyId, active: true, role: { in: ['OWNER', 'MANAGER'] } }, select: { email: true } })
  return users.map((u) => u.email)
}

/**
 * Creates the document-expiry notifications that are due, once per document per threshold.
 * A document gets the tightest threshold it has reached (for example 7 days, not also 14 and 30).
 * The unique (company, dedupKey) constraint guarantees no duplicates even if two runs overlap.
 */
export async function generateDocumentNotifications(companyId: string, now: Date = new Date()): Promise<number> {
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) return 0
  const thresholds = [...company.notifyThresholds].sort((a, b) => a - b)
  if (!thresholds.length) return 0

  const [docs, existing] = await Promise.all([
    prisma.document.findMany({ where: { companyId, vehicle: { is: { archived: false } } }, include: { vehicle: { select: { fleetId: true, registration: true } } } }),
    prisma.notification.findMany({ where: { companyId, dedupKey: { startsWith: 'doc:' } }, select: { dedupKey: true } }),
  ])
  const sent = new Set(existing.map((n) => n.dedupKey))
  const wantsEmail = company.notifyEmail
  const channel = !wantsEmail ? 'IN_APP' : emailConfigured() ? 'EMAIL_PENDING' : 'EMAIL_NOT_CONFIGURED'

  const fresh: { id?: string; key: string; title: string; body: string; vehicleId: string }[] = []
  for (const d of docs) {
    const left = daysLeft(d.expiryDate, now)
    const hit = reachedThreshold(left, thresholds)
    if (hit === undefined) continue
    const key = `doc:${d.id}:${hit}:${isoDay(d.expiryDate)}`
    if (sent.has(key)) continue
    fresh.push({
      key,
      vehicleId: d.vehicleId,
      title: left < 0 ? `${d.type} expired for ${d.vehicle.fleetId}` : `${d.type} for ${d.vehicle.fleetId} expires in ${left} day${left === 1 ? '' : 's'}`,
      body: `${d.vehicle.registration} · ${d.number} · expiry ${isoDay(d.expiryDate)}`,
    })
  }
  if (!fresh.length) return 0

  const created = await prisma.notification.createManyAndReturn({
    data: fresh.map((f) => ({ companyId, kind: 'DOCUMENT' as const, title: f.title, body: f.body, vehicleId: f.vehicleId, dedupKey: f.key, channel })),
    skipDuplicates: true,
  })

  if (channel === 'EMAIL_PENDING' && created.length) {
    const to = await recipients(companyId)
    for (const n of created) {
      const ok = await sendEmail(to, `[Fleet Predict] ${n.title}`, `${n.title}\n\n${n.body}\n\nOpen Fleet Predict to review the vehicle's documents.`)
      await prisma.notification.update({ where: { id: n.id }, data: { channel: ok ? 'EMAIL_SENT' : 'EMAIL_FAILED' } })
    }
  }
  return created.length
}

/** One in-app notification per component per month while it stays at critical priority. */
export async function generatePredictionNotifications(companyId: string, now: Date = new Date()): Promise<number> {
  const preds = await prisma.prediction.findMany({
    where: { companyId, category: 'CRITICAL', status: { not: 'RESOLVED' }, vehicle: { is: { archived: false } } },
    include: { vehicle: { select: { fleetId: true } } },
  })
  if (!preds.length) return 0
  const month = isoDay(now).slice(0, 7)
  const r = await prisma.notification.createMany({
    data: preds.map((p) => ({
      companyId,
      kind: 'PREDICTION' as const,
      title: `${p.vehicle.fleetId}: ${COMPONENTS[p.component].label.toLowerCase()} reached critical priority`,
      body: `Priority score ${p.score}/100. ${p.action}`,
      vehicleId: p.vehicleId,
      dedupKey: `pred:${p.vehicleId}:${p.component}:${month}`,
      channel: 'IN_APP',
    })),
    skipDuplicates: true,
  })
  return r.count
}

export async function runForCompany(companyId: string) {
  const documents = await generateDocumentNotifications(companyId)
  const predictions = await generatePredictionNotifications(companyId)
  return { documents, predictions }
}

/** Daily job entry point. Safe to run repeatedly because of the dedup keys. */
export async function runForAllCompanies() {
  const companies = await prisma.company.findMany({ select: { id: true } })
  let documents = 0
  let predictions = 0
  for (const c of companies) {
    try {
      const r = await runForCompany(c.id)
      documents += r.documents
      predictions += r.predictions
    } catch (e) {
      console.error('Notification run failed for a company:', (e as Error).message)
    }
  }
  return { companies: companies.length, documents, predictions }
}
