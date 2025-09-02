import { describe, it, expect } from 'vitest'
import { createQuery } from '../query'
import { ComponentName } from '../components'

describe('createQuery', () => {
  it('should create a query object with the given name and components', () => {
    const name = 'testQuery'
    const components: readonly ComponentName[] = ['position', 'velocity']
    const query = createQuery(name, components)

    expect(query.name).toBe(name)
    expect(query.components).toEqual(components)
  })

  it('should handle an empty component list', () => {
    const name = 'emptyQuery'
    const components: readonly ComponentName[] = []
    const query = createQuery(name, components)

    expect(query.name).toBe(name)
    expect(query.components).toEqual([])
  })
})
