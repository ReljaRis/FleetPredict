import { describe, expect, it } from 'vitest'
import { CATALOG_COMPONENT, componentFromTitle, groupIssues } from './known-issues.js'

describe('catalogue mapping', () => {
  it('maps every catalogue component to one of the scored components', () => {
    expect(Object.keys(CATALOG_COMPONENT)).toHaveLength(12)
    expect(CATALOG_COMPONENT.turbocharger).toBe('TURBO')
    expect(CATALOG_COMPONENT.fuel_injectors).toBe('FUEL')
    expect(CATALOG_COMPONENT.cooling_system).toBe('COOLING')
    expect(CATALOG_COMPONENT.egr).toBe('ENGINE')
  })
  it('reads the component from an engine-level issue title', () => {
    expect(componentFromTitle('Turbocharger oil pressure line flange (DSVA recall, D20/D26)')).toBe('TURBO')
    expect(componentFromTitle('Fuel-pump tappet failure in March 2014 production')).toBe('FUEL')
    expect(componentFromTitle('EGR cooler failure (supplier guidance)')).toBe('ENGINE')
    expect(componentFromTitle('Piston seizure in coach application')).toBe('ENGINE')
  })
  it('groups by engine and component and drops repeated titles', () => {
    const g = groupIssues([
      { code: 'MX-13', component: 'ENGINE', id: 'a', title: 'EGR cooler leak', description: 'x' },
      { code: 'MX-13', component: 'ENGINE', id: 'b', title: 'egr cooler leak', description: 'y' },
      { code: 'MX-13', component: 'TURBO', id: 'c', title: 'Turbo fault', description: null },
    ])
    expect(g.get('MX-13')!.get('ENGINE')).toHaveLength(1)
    expect(g.get('MX-13')!.get('TURBO')![0].description).toBe('')
  })
})
