import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'
import { env } from '../../config/env.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, unauthorized } from '../../lib/errors.js'

const COST = 12
// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST)

export const SESSION_DAYS = 7

export function signToken(userId: string) {
  return jwt.sign({}, env.JWT_SECRET, { subject: userId, expiresIn: `${SESSION_DAYS}d` })
}

export async function registerCompany(input: { company: string; name: string; email: string; password: string }) {
  const email = input.email.toLowerCase()
  if (await prisma.user.findUnique({ where: { email } })) {
    throw conflict('An account with this email already exists.', { email: 'This email is already registered.' })
  }
  const passwordHash = await bcrypt.hash(input.password, COST)
  // The first user of a new company is always its Owner.
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: input.company } })
    return tx.user.create({ data: { companyId: company.id, name: input.name, email, passwordHash, role: Role.OWNER } })
  })
}

export async function authenticate(emailRaw: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: emailRaw.toLowerCase() } })
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok || !user.active) throw unauthorized('Email or password is not correct.')
  return user
}

export async function profile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { company: true } })
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    company: { id: user.company.id, name: user.company.name, isDemo: user.company.isDemo },
  }
}

export async function hash(password: string) {
  return bcrypt.hash(password, COST)
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!(await bcrypt.compare(current, user.passwordHash))) throw badRequest('Some fields need attention.', { currentPassword: 'The current password is not correct.' })
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, COST) } })
}
