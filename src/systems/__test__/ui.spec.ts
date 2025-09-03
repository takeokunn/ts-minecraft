import { Effect, Layer } from 'effect'
import { describe, it, expect, vi, beforeEach } from '@effect/vitest'
import { uiSystem } from '../ui'
import { UIService, World } from '@/runtime/services'
import { Hotbar } from '@/domain/components'
import { SoA } from '@/domain/world'
import { playerQuery } from '@/domain/queries'
import { EntityId } from '@/domain/entity'

const mockWorld: Partial<World> = {
  querySoA: vi.fn(),
}

const mockUIService: Partial<UIService> = {
  updateHotbar: vi.fn(),
}

const worldLayer = Layer.succeed(World, mockWorld as World)
const uiServiceLayer = Layer.succeed(UIService, mockUIService as UIService)
const testLayer = worldLayer.pipe(Layer.provide(uiServiceLayer))

describe('uiSystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it.effect('should update the hotbar UI', () =>
    Effect.gen(function* ($) {
      const hotbar = new Hotbar({
        slots: ['grass', 'dirt'],
        selectedIndex: 0,
      })
      const soa: SoA<typeof playerQuery> = {
        entities: [EntityId('player')],
        components: {
          player: [],
          position: [],
          velocity: [],
          inputState: [],
          cameraState: [],
          hotbar: [hotbar],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))
      vi.spyOn(mockUIService, 'updateHotbar').mockReturnValue(Effect.succeed(undefined))

      yield* $(uiSystem)

      expect(mockUIService.updateHotbar).toHaveBeenCalledWith(hotbar)
    }).pipe(Effect.provide(testLayer)))

  it.effect('should not do anything if there are no players', () =>
    Effect.gen(function* ($) {
      const soa: SoA<typeof playerQuery> = {
        entities: [],
        components: {
          player: [],
          position: [],
          velocity: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))

      yield* $(uiSystem)

      expect(mockUIService.updateHotbar).not.toHaveBeenCalled()
    }).pipe(Effect.provide(testLayer)))

  it.effect('should not do anything if there is no hotbar', () =>
    Effect.gen(function* ($) {
      const soa: SoA<typeof playerQuery> = {
        entities: [EntityId('player')],
        components: {
          player: [],
          position: [],
          velocity: [],
          inputState: [],
          cameraState: [],
          hotbar: [],
        },
      }

      vi.spyOn(mockWorld, 'querySoA').mockReturnValue(Effect.succeed(soa))

      yield* $(uiSystem)

      expect(mockUIService.updateHotbar).not.toHaveBeenCalled()
    }).pipe(Effect.provide(testLayer)))
})