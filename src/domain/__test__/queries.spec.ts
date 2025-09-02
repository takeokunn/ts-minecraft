import { describe, it, expect } from 'vitest'
import * as Q from '../queries'
import { Query } from '../query'

describe('queries', () => {
  const queries: Record<string, unknown> = Q

  for (const [name, query] of Object.entries(queries)) {
    it(`${name} should be a valid query object`, () => {
      expect(query).toBeDefined()
      expect(query).toHaveProperty('name')
      expect(query).toHaveProperty('components')
      const q = query as Query
      expect(typeof q.name).toBe('string')
      expect(Array.isArray(q.components)).toBe(true)
    })
  }
})
