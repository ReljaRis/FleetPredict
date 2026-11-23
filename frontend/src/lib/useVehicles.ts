import { useApi } from './useApi'
import type { VehicleListItem } from './types'

/** Active vehicles the signed-in user can see, for vehicle pickers and filters. */
export function useVehicles() {
  return useApi<VehicleListItem[]>('/vehicles?archived=false&sort=fleetId&dir=asc')
}
