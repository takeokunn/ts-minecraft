import { Effect, Ref } from 'effect'
import { describe, it, expect } from 'vitest'
import { createUISystem, HotbarUpdater } from '../ui'
import { GameState, GameStateService } from '@/runtime/services'
import { Hotbar } from '@/domain/components'
import type { BlockType } from '@/domain/block'

describe('uiSystem', () => {
  it('should call the hotbar updater with the GameState hotbar state', () =>
    Effect.gen(function* ($) {
      const updatedHotbar = yield* $(Ref.make<Hotbar | null>(null))
      const hotbarUpdater: HotbarUpdater = (hotbar) => Ref.set(updatedHotbar, hotbar)
      const uiSystem = createUISystem(hotbarUpdater)

      const mockHotbar = new Hotbar({
        slots: ['grass', 'dirt'] as BlockType[],
        selectedIndex: 0,
      })

      const mockGameState: GameState = {
        hotbar: mockHotbar,
      }

      yield* $(Effect.provideService(uiSystem, GameStateService, mockGameState))

      const result = yield* $(Ref.get(updatedHotbar))
      expect(result).toEqual(mockHotbar)
    }))

  it('should call the hotbar updater with a different GameState', () =>
    Effect.gen(function* ($) {
      const updatedHotbar = yield* $(Ref.make<Hotbar | null>(null))
      const hotbarUpdater: HotbarUpdater = (hotbar) => Ref.set(updatedHotbar, hotbar)
      const uiSystem = createUISystem(hotbarUpdater)

      const mockHotbar = new Hotbar({
        slots: ['cobblestone', 'stone'] as BlockType[],
        selectedIndex: 1,
      })

      const mockGameState: GameState = {
        hotbar: mockHotbar,
      }

      yield* $(Effect.provideService(uiSystem, GameStateService, mockGameState))

      const result = yield* $(Ref.get(updatedHotbar))
      expect(result).toEqual(mockHotbar)
    }))
})
