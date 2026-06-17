import { Effect, Match, Option } from 'effect'
import { RedstoneComponentType } from '@ts-minecraft/entity'
import type { BlockType, Position } from '@ts-minecraft/core'
import type { FrameRedstoneInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types'
import type { TargetBlockHit } from '@ts-minecraft/app/frame/stages/interaction-types'

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


const placeComponentAndBlock = (
  services: FrameRedstoneInteractionServices,
  componentType: RedstoneComponentType,
  worldBlock: BlockType,
  position: Position,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* services.redstoneService.setComponent(position, componentType)
    yield* services.blockService.forceSetBlock(position, worldBlock).pipe(Effect.catchAll(() => Effect.void))
  })

const dispatchRedstoneAction = (
  services: FrameRedstoneInteractionServices,
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
  services: FrameRedstoneInteractionServices,
  flags: RedstoneFlags,
  targetBlock: Option.Option<TargetBlockHit>,
): Effect.Effect<void, never> =>
  Effect.succeed(Option.getOrNull(targetBlock)).pipe(
    Effect.flatMap((tb) => (tb === null ? Effect.void : dispatchRedstoneAction(services, flags, tb))),
    Effect.flatMap(() => services.redstoneService.tick()),
  )
