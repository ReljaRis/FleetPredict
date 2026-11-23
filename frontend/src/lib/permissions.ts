import type { Role } from './auth'

export type Permission = 'vehicle:write' | 'vehicle:delete' | 'reading:write' | 'trip:write' | 'maintenance:write' | 'fault:write' | 'fault:update' | 'document:write' | 'prediction:act' | 'costs:write' | 'company:write' | 'users:write' | 'fleet:read-all'

const ALL: Permission[] = ['vehicle:write', 'vehicle:delete', 'reading:write', 'trip:write', 'maintenance:write', 'fault:write', 'fault:update', 'document:write', 'prediction:act', 'costs:write', 'company:write', 'users:write', 'fleet:read-all']

/** Mirror of the server matrix, used only to hide controls. The server enforces every one of these. */
const MATRIX: Record<Role, Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== 'company:write' && p !== 'users:write'),
  MECHANIC: ['reading:write', 'maintenance:write', 'fault:write', 'fault:update', 'prediction:act', 'fleet:read-all'],
  DRIVER: ['fault:write'],
}

export const can = (role: Role | undefined, p: Permission) => !!role && MATRIX[role].includes(p)
