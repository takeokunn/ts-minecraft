import { Effect, Match, Option } from 'effect'
import { RedstoneComponentType } from '@ts-minecraft/entity'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'
import type { Position } from '@ts-minecraft/core'

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

const dispatchRedstoneAction = (
  services: Pick<FrameHandlerServices, 'redstoneService'>,
  flags: RedstoneFlags,
  position: Position,
): Effect.Effect<void, never> =>
  Match.value(flags).pipe(
    Match.when({ placeWire: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Wire)),
    Match.when({ placeLever: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Lever)),
    Match.when({ placeButton: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Button)),
    Match.when({ placeTorch: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Torch)),
    Match.when({ placePiston: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Piston)),
    Match.when({ toggleLever: true }, () => services.redstoneService.toggleLever(position)),
    Match.when({ pressButton: true }, () => services.redstoneService.pressButton(position)),
    Match.when({ toggleTorch: true }, () => services.redstoneService.toggleTorch(position)),
    Match.orElse(() => Effect.void),
  )

export const handleRedstoneInput = (
  services: Pick<FrameHandlerServices, 'redstoneService'>,
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
