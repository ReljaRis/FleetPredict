import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import authRoutes from './modules/auth/auth.routes.js'
import catalogRoutes from './modules/catalog/catalog.routes.js'
import userRoutes from './modules/users/users.routes.js'
import maintenanceRoutes from './modules/maintenance/maintenance.module.js'
import faultRoutes from './modules/faults/faults.module.js'
import documentRoutes from './modules/documents/documents.module.js'
import tripRoutes from './modules/trips/trips.module.js'
import predictionRoutes, { costsRouter } from './modules/engine/engine.routes.js'
import companyRoutes from './modules/company/company.routes.js'
import notificationRoutes from './modules/notifications/notifications.routes.js'
import dashboardRoutes from './modules/dashboard/dashboard.module.js'
import { refreshAfterWrite } from './middleware/refresh.js'
import vehicleRoutes from './modules/vehicles/vehicle.routes.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '200kb' }))
  app.use(cookieParser())

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api', refreshAfterWrite)
  app.use('/api/auth', authRoutes)
  app.use('/api/catalog', catalogRoutes)
  app.use('/api/vehicles', vehicleRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/maintenance', maintenanceRoutes)
  app.use('/api/faults', faultRoutes)
  app.use('/api/documents', documentRoutes)
  app.use('/api/trips', tripRoutes)
  app.use('/api/predictions', predictionRoutes)
  app.use('/api/costs', costsRouter)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/company', companyRoutes)
  app.use('/api/notifications', notificationRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
