// Removes only the throw-away company created by my API isolation test (matched by its exact owner email).
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const r = await p.company.deleteMany({ where: { isDemo: false, users: { some: { email: 'owner.iso4@example.com' } } } })
console.log('test companies removed:', r.count)
console.log('companies now:', (await p.company.findMany({ select: { name: true, isDemo: true } })).map((c) => `${c.name}${c.isDemo ? ' (demo)' : ''}`).join(', '))
await p.$disconnect()
