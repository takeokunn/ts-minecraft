import { describe, it, expect } from '@effect/vitest'
import * as Q from '../queries'

describe('Queries', () => {
  it('should match the snapshot', () => {
    expect(Q).toMatchSnapshot()
  })
})