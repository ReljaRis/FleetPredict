import { env } from './config/env.js'
import { createApp } from './app.js'
import { prisma } from './lib/prisma.js'
import { runForAllCompanies } from './modules/notifications/notifications.service.js'

const app = createApp()
const server = app.listen(env.PORT, () => console.log(`Fleet Predict API listening on http://localhost:${env.PORT}`))

// Document reminders and critical-priority alerts. Safe to repeat: every notification has a unique key.
const job = () => runForAllCompanies().then((r) => console.log(`Notification run: ${r.documents} document, ${r.predictions} prediction notifications for ${r.companies} companies.`)).catch((e) => console.error('Notification run failed:', e))
setTimeout(job, 15_000).unref()
setInterval(job, 6 * 60 * 60 * 1000).unref()

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    server.close()
    await prisma.$disconnect()
    process.exit(0)
  })
}
