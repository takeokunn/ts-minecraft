import { Effect } from 'effect'
import { describe, it, expect, vi } from 'vitest'
import { createUISystem, HotbarUpdater } from '../ui'
import { GameState, GameStateService } from '@/runtime/services'
import { Hotbar } from '@/domain/components'
import type { BlockType } from '@/domain/block'

describe('uiSystem', () => {
  it('should call the hotbar updater with the GameState hotbar state', async () => {
    const hotbarUpdater: HotbarUpdater = vi.fn(() => Effect.void)
    const uiSystem = createUISystem(hotbarUpdater)

    const mockHotbar = new Hotbar({
      slots: ['grass', 'dirt'] as BlockType[],
      selectedIndex: 0,
    })

    const mockGameState: GameState = {
      hotbar: mockHotbar,
    }

    const program = Effect.gen(function* (_) {
      yield* _(uiSystem)
      expect(hotbarUpdater).toHaveBeenCalledWith(mockHotbar)
    })

    await Effect.runPromise(Effect.provideService(program, GameStateService, mockGameState))
  })

  it('should call the hotbar updater with a different GameState', async () => {
    const hotbarUpdater: HotbarUpdater = vi.fn(() => Effect.void)
    const uiSystem = createUISystem(hotbarUpdater)

    const mockHotbar = new Hotbar({
      slots: ['cobblestone', 'stone'] as BlockType[],
      selectedIndex: 1,
    })

    const mockGameState: GameState = {
      hotbar: mockHotbar,
    }

    const program = Effect.gen(function* (_) {
      yield* _(uiSystem)
      expect(hotbarUpdater).toHaveBeenCalledWith(mockHotbar)
    })

    await Effect.runPromise(Effect.provideService(program, GameStateService, mockGameState))
  })
})
