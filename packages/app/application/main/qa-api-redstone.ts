import { Effect } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { RedstoneService } from '@ts-minecraft/entity/application/redstone/redstone-service'
import { RedstoneComponentType } from '@ts-minecraft/entity/domain/redstone/redstone-model'

// Redstone lives in its own component graph (not raw world blocks), placed via a
// key-driven interaction handler, so it was undrivable from QA. These expose the
// graph primitives directly: register a component, toggle a lever, step the
// simulation a fixed number of ticks, and read the power at a cell — enough to
// build and verify a lever→wire→lamp circuit deterministically.

const COMPONENT_TYPES: Record<string, RedstoneComponentType> = {
  wire: RedstoneComponentType.Wire,
  lever: RedstoneComponentType.Lever,
  button: RedstoneComponentType.Button,
  torch: RedstoneComponentType.Torch,
  lamp: RedstoneComponentType.Lamp,
  repeater: RedstoneComponentType.Repeater,
  comparator: RedstoneComponentType.Comparator,
}

export const setRedstoneComponentForQA = (
  redstoneService: RedstoneService,
  x: number,
  y: number,
  z: number,
  type: string,
): Promise<boolean> => {
  const componentType = COMPONENT_TYPES[type]
  if (componentType === undefined) return Promise.resolve(false)
  return Effect.runPromise(redstoneService.setComponent({ x, y, z } as Position, componentType).pipe(Effect.as(true)))
}

export const toggleLeverForQA = (redstoneService: RedstoneService, x: number, y: number, z: number): Promise<boolean> =>
  Effect.runPromise(redstoneService.toggleLever({ x, y, z } as Position).pipe(Effect.map((c) => c._tag === 'Some')))

// Steps the simulation `ticks` times so power propagates deterministically
// instead of waiting on the frame loop's own cadence.
export const tickRedstoneForQA = (redstoneService: RedstoneService, ticks: number): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* () {
      for (let i = 0; i < Math.max(1, ticks); i++) {
        yield* redstoneService.tick()
      }
    }),
  )

export const getRedstonePowerAtForQA = (redstoneService: RedstoneService, x: number, y: number, z: number): Promise<number> =>
  Effect.runPromise(redstoneService.getPowerAt({ x, y, z } as Position))
