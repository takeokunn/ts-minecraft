import { Effect, Match, Option } from 'effect'
import { RedstoneComponentType } from '@ts-minecraft/entity'
import type { BlockType, Position } from '@ts-minecraft/core'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

export type RedstoneFlags = {
  readonly placeWire: boolean
  readonly placeLever: boolean
  readonly placeButton: boolean
  readonly placeTorch: boolean
  readonly placePiston: boolean
  readonly toggleLever: boolean
  readonly pressButton: boolean
  readonly toggleTorch: boolean
}

type TargetBlockHit = { readonly x: number; readonly y: number; readonly z: number }


const placeComponentAndBlock = (
  services: Pick<FrameHandlerServices, 'redstoneService' | 'blockService'>,
  componentType: RedstoneComponentType,
  worldBlock: BlockType,
  position: Position,
): Effect.Effect<void, never> =>
  Effect.all(
    [
      services.redstoneService.setComponent(position, componentType),
      services.blockService.forceSetBlock(position, worldBlock).pipe(Effect.catchAll(() => Effect.void)),
    ],
    { concurrency: 'unbounded', discard: true },
  )

const dispatchRedstoneAction = (
  services: Pick<FrameHandlerServices, 'redstoneService' | 'blockService'>,
  flags: RedstoneFlags,
  position: Position,
): Effect.Effect<void, never> =>
  Match.value(flags).pipe(
    Match.when({ placeWire: true },   () => placeComponentAndBlock(services, RedstoneComponentType.Wire,   'REDSTONE_WIRE',   position)),
    Match.when({ placeLever: true },  () => placeComponentAndBlock(services, RedstoneComponentType.Lever,  'LEVER',           position)),
    Match.when({ placeButton: true }, () => placeComponentAndBlock(services, RedstoneComponentType.Button, 'STONE_BUTTON',    position)),
    Match.when({ placeTorch: true },  () => placeComponentAndBlock(services, RedstoneComponentType.Torch,  'REDSTONE_TORCH',  position)),
    Match.when({ placePiston: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Piston)),
    Match.when({ toggleLever: true }, () => services.redstoneService.toggleLever(position)),
    Match.when({ pressButton: true }, () => services.redstoneService.pressButton(position)),
    Match.when({ toggleTorch: true }, () => services.redstoneService.toggleTorch(position)),
    Match.orElse(() => Effect.void),
  )

export const handleRedstoneInput = (
  services: Pick<FrameHandlerServices, 'redstoneService' | 'blockService'>,
  flags: RedstoneFlags,
  targetBlock: Option.Option<TargetBlockHit>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* Option.match(targetBlock, {
      onNone: () => Effect.void,
      onSome: (tb) => dispatchRedstoneAction(services, flags, { x: tb.x, y: tb.y, z: tb.z }),
    })
    yield* services.redstoneService.tick()
  })
