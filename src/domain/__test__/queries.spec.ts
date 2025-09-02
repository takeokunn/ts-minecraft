import { describe, it, expect } from 'vitest'
import * as Q from '../queries'
import { Query } from '../query'

describe('queries', () => {
  const queries: Record<string, Query> = Q as any

  for (const [name, query] of Object.entries(queries)) {
    it(`${name} should be a valid query object`, () => {
      expect(query).toBeDefined()
      expect(typeof query.name).toBe('string')
      expect(Array.isArray(query.components)).toBe(true)
    })
  }
})
