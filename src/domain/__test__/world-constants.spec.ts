import { describe, it, expect } from '@effect/vitest'
import * as WorldConstants from '../world-constants'

describe('WorldConstants', () => {
  it('should match the snapshot', () => {
    expect(WorldConstants).toMatchSnapshot()
  })
})
