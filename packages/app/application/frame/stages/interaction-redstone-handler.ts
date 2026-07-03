import { Effect, Match, Option } from 'effect'
import { RedstoneComponentType, type PistonFacing } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import type { BlockType, Position } from '@ts-minecraft/core'
import type { FrameRedstoneInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/redstone'
import type { TargetBlockHit } from '@ts-minecraft/app/frame/stages/interaction-types'
import type * as THREE from 'three'

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

// Dominant axis of the camera's look direction — a piston placed while
// looking east pushes east (away from the player), vanilla-style. A steep
// pitch (vertical component dominating both horizontal ones) selects up/down.
export const pistonFacingFromDirection = (dirX: number, dirY: number, dirZ: number): PistonFacing => {
  const absY = Math.abs(dirY)
  if (absY > Math.abs(dirX) && absY > Math.abs(dirZ)) {
    return dirY >= 0 ? 'up' : 'down'
  }
  return Math.abs(dirX) >= Math.abs(dirZ)
    ? (dirX >= 0 ? 'east' : 'west')
    : (dirZ >= 0 ? 'south' : 'north')
}

export const pistonFacingFromCamera = (
  camera: Pick<THREE.Camera, 'getWorldDirection'>,
  scratch: THREE.Vector3,
): PistonFacing => {
  camera.getWorldDirection(scratch)
  return pistonFacingFromDirection(scratch.x, scratch.y, scratch.z)
}

const placeComponentAndBlock = (
  services: FrameRedstoneInteractionServices,
  componentType: RedstoneComponentType,
  worldBlock: BlockType,
  position: Position,
  options?: { readonly pistonFacing?: PistonFacing },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Arity-preserving: only piston placement carries options — non-piston
    // calls stay 2-arg so exact-argument assertions (and any positional
    // wrappers) see the historical shape.
    yield* (options !== undefined
      ? services.redstoneService.setComponent(position, componentType, options)
      : services.redstoneService.setComponent(position, componentType))
    yield* services.blockService.forceSetBlock(position, worldBlock).pipe(Effect.catchAll(() => Effect.void))
  })

const dispatchRedstoneAction = (
  services: FrameRedstoneInteractionServices,
  flags: RedstoneFlags,
  position: Position,
  pistonFacing: PistonFacing | undefined,
): Effect.Effect<void, never> =>
  Match.value(flags).pipe(
    Match.when({ placeWire: true },   () => placeComponentAndBlock(services, RedstoneComponentType.Wire,   'REDSTONE_WIRE',   position)),
    Match.when({ placeLever: true },  () => placeComponentAndBlock(services, RedstoneComponentType.Lever,  'LEVER',           position)),
    Match.when({ placeButton: true }, () => placeComponentAndBlock(services, RedstoneComponentType.Button, 'STONE_BUTTON',    position)),
    Match.when({ placeTorch: true },  () => placeComponentAndBlock(services, RedstoneComponentType.Torch,  'REDSTONE_TORCH',  position)),
    Match.when({ placePiston: true }, () => placeComponentAndBlock(services, RedstoneComponentType.Piston, 'PISTON', position, pistonFacing !== undefined ? { pistonFacing } : undefined)),
    Match.when({ toggleLever: true }, () => services.redstoneService.toggleLever(position)),
    Match.when({ pressButton: true }, () => services.redstoneService.pressButton(position)),
    Match.when({ toggleTorch: true }, () => services.redstoneService.toggleTorch(position)),
    Match.orElse(() => Effect.void),
  )

export const handleRedstoneInput = (
  services: FrameRedstoneInteractionServices,
  flags: RedstoneFlags,
  targetBlock: Option.Option<TargetBlockHit>,
  // Player-view cardinal captured by the caller (has camera access); only
  // consumed by piston placement.
  pistonFacing?: PistonFacing,
): Effect.Effect<void, never> =>
  Effect.succeed(Option.getOrNull(targetBlock)).pipe(
    Effect.flatMap((tb) => (tb === null ? Effect.void : dispatchRedstoneAction(services, flags, tb, pistonFacing))),
    Effect.flatMap(() => services.redstoneService.tick()),
  )
