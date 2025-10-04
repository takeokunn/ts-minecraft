import { describe, expect, it } from '@effect/vitest'
import * as Layer from 'effect/Layer'
import { InteractionDomainLive } from '../../layer'

describe('interaction layer', () => {
  it('exposes a valid layer', () => {
    expect(Layer.isLayer(InteractionDomainLive)).toBe(true)
  })
})
