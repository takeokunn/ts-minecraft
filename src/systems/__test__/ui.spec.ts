import { Hotbar } from '@/domain/components'
import { playerQuery } from '@/domain/queries'
import { uiSystem } from '@/systems/ui'
import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer, Context } from 'effect'
import { UIService, World } from '@/runtime/services'

describe('UISystem', () => {
  it.effect('should update the hotbar when a player exists', () =>
    Effect.gen(function* ($) {
      const hotbar: Hotbar = {
        inventory: [null, null, null, null, null, null, null, null, null],
        selectedSlot: 0,
      }

      const mockUIService = {
        updateHotbar: vi.fn(() => Effect.void),
      }

      const mockWorld = {
        querySoA: vi.fn((query) => {
          if (query === playerQuery) {
            return Effect.succeed({
              components: {
                hotbar: [hotbar],
              },
            })
          }
          return Effect.succeed({ components: {} })
        }),
      }

      const UIServiceLive = Layer.succeed(UIService, mockUIService)
      const WorldLive = Layer.succeed(World, mockWorld as any)
      const TestLayer = Layer.merge(UIServiceLive, WorldLive)

      yield* $(uiSystem)

      assert.isTrue(mockUIService.updateHotbar.mock.calls.length === 1)
      assert.deepStrictEqual(mockUIService.updateHotbar.mock.calls[0][0], hotbar)
    }).pipe(Effect.provide(Layer.merge(
      Layer.succeed(UIService, { updateHotbar: vi.fn(() => Effect.void) }),
      Layer.succeed(World, {
        querySoA: () => Effect.succeed({
          components: {
            hotbar: [{
              inventory: [null, null, null, null, null, null, null, null, null],
              selectedSlot: 0,
            }],
          },
        }),
      } as any),
    ))))

  it.effect('should not update the hotbar when no player exists', () =>
    Effect.gen(function* ($) {
      const mockUIService = {
        updateHotbar: vi.fn(() => Effect.void),
      }

      const mockWorld = {
        querySoA: vi.fn((query) => {
          if (query === playerQuery) {
            return Effect.succeed({
              components: {
                hotbar: [],
              },
            })
          }
          return Effect.succeed({ components: {} })
        }),
      }

      const UIServiceLive = Layer.succeed(UIService, mockUIService)
      const WorldLive = Layer.succeed(World, mockWorld as any)
      const TestLayer = Layer.merge(UIServiceLive, WorldLive)

      yield* $(uiSystem.pipe(Effect.provide(TestLayer)))

      assert.isTrue(mockUIService.updateHotbar.mock.calls.length === 0)
    }))
})