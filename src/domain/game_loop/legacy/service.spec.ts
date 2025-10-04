import { describe, expect, it } from 'vitest'

import { GameLoopService } from './service'

describe('GameLoopService tag', () => {
  it('exposes the canonical identifier', () => {
    expect(GameLoopService.key).toBe('@minecraft/domain/GameLoopService')
  })
})
