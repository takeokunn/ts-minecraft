import { describe, it, expect } from '@effect/vitest'
import * as S from '../services'

describe('Services', () => {
  it('should export all service tags', () => {
    expect(S.World).toBeDefined()
    expect(S.Renderer).toBeDefined()
    expect(S.InputManager).toBeDefined()
    expect(S.Raycast).toBeDefined()
    expect(S.MaterialManager).toBeDefined()
    expect(S.SpatialGrid).toBeDefined()
    expect(S.ComputationWorker).toBeDefined()
    expect(S.Clock).toBeDefined()
    expect(S.Stats).toBeDefined()
    expect(S.DeltaTime).toBeDefined()
    expect(S.UIService).toBeDefined()
  })
})
