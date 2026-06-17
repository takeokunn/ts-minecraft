import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'

import { resolveBucketFluidBlock, resolveFilledBucketType } from './interaction-bucket-handler/bucket-handler'

describe('interaction-bucket-handler helpers', () => {
  it('maps fluid blocks to the matching filled bucket type', () => {
    expect(resolveFilledBucketType('WATER')).toBe('WATER_BUCKET')
    expect(resolveFilledBucketType('LAVA')).toBe('LAVA_BUCKET')
  })

  it('maps filled buckets back to their fluid blocks', () => {
    expect(resolveBucketFluidBlock('WATER_BUCKET')).toBe('WATER')
    expect(resolveBucketFluidBlock('LAVA_BUCKET')).toBe('LAVA')
  })
})
