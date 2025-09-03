import { describe, it, assert, vi } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import { createUISystem } from '@/systems/ui'
import { UIService, World } from '@/runtime/services'
import { SoAResult } from '@/domain/types'
import { playerQuery } from '@/domain/queries'
import { arbitraryHotbar } from '@test/arbitraries'
import { Hotbar } from '@/domain/components'

describe('UISystem', () => {
  it.effect('should adhere to UI properties', () =>
    Effect.promise(() =>
      fc.assert(
        fc.asyncProperty(
          fc.option(arbitraryHotbar, { nil: undefined }),
          async (hotbarOpt) => {
            const soa: SoAResult<typeof playerQuery.components> = {
              entities: [],
              components: {
                hotbar: hotbarOpt ? [hotbarOpt] : [],
              },
            } as any

            const updateHotbarSpy = vi.fn(() => Effect.void)
            const mockUIService: Partial<UIService> = {
              updateHotbar: updateHotbarSpy,
            }

            const mockWorld: Partial<World> = {
              querySoA: () => Effect.succeed(soa),
            }

            const testLayer = Layer.succeed(UIService, mockUIService as UIService).pipe(
              Layer.provide(Layer.succeed(World, mockWorld as World)),
            )

            await Effect.runPromise(createUISystem.pipe(Effect.provide(testLayer)))

            if (hotbarOpt) {
              assert.strictEqual(updateHotbarSpy.mock.calls.length, 1)
              assert.deepStrictEqual(updateHotbarSpy.mock.calls[0][0], hotbarOpt)
            } else {
              assert.strictEqual(updateHotbarSpy.mock.calls.length, 0)
            }
          },
        ),
      ),
    ),
  )
})
