import type { Role } from '@prisma/client'

export type Permission =
  | 'vehicle:write'
  | 'vehicle:delete'
  | 'reading:write'
  | 'trip:write'
  | 'maintenance:write'
  | 'fault:write'
  | 'fault:update'
  | 'document:write'
  | 'prediction:act'
  | 'costs:write'
  | 'company:write'
  | 'users:write'
  | 'fleet:read-all'

const ALL: Permission[] = [
  'vehicle:write', 'vehicle:delete', 'reading:write', 'trip:write', 'maintenance:write', 'fault:write', 'fault:update',
  'document:write', 'prediction:act', 'costs:write', 'company:write', 'users:write', 'fleet:read-all',
]

/** Single source of truth for role permissions. Enforced on the server; the frontend only mirrors it for display. */
export const MATRIX: Record<Role, Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== 'company:write' && p !== 'users:write'),
  MECHANIC: ['reading:write', 'maintenance:write', 'fault:write', 'fault:update', 'prediction:act', 'fleet:read-all'],
  DRIVER: ['fault:write'],
}

export const can = (role: Role, p: Permission) => MATRIX[role].includes(p)
