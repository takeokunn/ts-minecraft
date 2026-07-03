import { Effect, HashMap, MutableRef, Option } from 'effect'
import type { BlockType, Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'

export type RedstonePistonWorldServices = Pick<FrameHandlerServices, 'blockService' | 'chunkManagerService'>
export type RedstonePistonWorldRefs = Pick<FrameStageRefs, 'dirtyChunksRef'>

const PISTON_IMMOVABLE_BLOCKS: ReadonlySet<BlockType> = new Set([
  'AIR',
  'BEDROCK',
  'WATER',
  'LAVA',
  'FIRE',
  'NETHER_PORTAL',
  'END_PORTAL',
  'END_PORTAL_FRAME',
  'END_PORTAL_FRAME_FILLED',
  'END_GATEWAY',
  'DRAGON_EGG',
  'END_CRYSTAL',
  'PISTON',
  'CHEST',
  'FURNACE',
  'SHULKER_BOX',
  'ANVIL',
  'CAULDRON',
  'WATER_CAULDRON',
])

// Push vector per stored facing; components placed before facing existed
// default to east (the historical fixed +x behavior).
const PISTON_PUSH_DIRECTIONS = {
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  south: { x: 0, y: 0, z: 1 },
  north: { x: 0, y: 0, z: -1 },
} as const
type PushDirection = (typeof PISTON_PUSH_DIRECTIONS)[keyof typeof PISTON_PUSH_DIRECTIONS]

export const isPistonMovableBlock = (blockType: BlockType): boolean =>
  !PISTON_IMMOVABLE_BLOCKS.has(blockType)

const redstonePositionKey = (position: Position): string =>
  `${Math.floor(position.x)},${Math.floor(position.y)},${Math.floor(position.z)}`

const addPositions = (position: Position, direction: PushDirection): Position => ({
  x: Math.floor(position.x) + direction.x,
  y: Math.floor(position.y) + direction.y,
  z: Math.floor(position.z) + direction.z,
})

const markChunkDirty = (
  refs: RedstonePistonWorldRefs,
  services: Pick<RedstonePistonWorldServices, 'chunkManagerService'>,
  position: Position,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const coord = worldToChunkCoord(position)
    const coordKey = `${coord.x},${coord.z}`
    yield* services.chunkManagerService.getChunk(coord).pipe(
      Effect.tap((chunk) =>
        Effect.sync(() => {
          MutableRef.set(
            refs.dirtyChunksRef,
            HashMap.set(MutableRef.get(refs.dirtyChunksRef), coordKey, { chunk, dirtyAABB: Option.none() }),
          )
        }),
      ),
      Effect.catchAll(() => Effect.void),
    )
  })

const readBlock = (
  services: Pick<RedstonePistonWorldServices, 'blockService'>,
  position: Position,
): Effect.Effect<BlockType | null, never> =>
  services.blockService.getBlock(position).pipe(Effect.catchAll(() => Effect.succeed(null)))

const forceSetBlockSafely = (
  services: Pick<RedstonePistonWorldServices, 'blockService'>,
  position: Position,
  blockType: BlockType,
): Effect.Effect<boolean, never> =>
  services.blockService.forceSetBlock(position, blockType).pipe(
    Effect.as(true),
    Effect.catchAll(() => Effect.succeed(false)),
  )

const pushSingleBlock = (
  services: RedstonePistonWorldServices,
  refs: RedstonePistonWorldRefs,
  pistonPosition: Position,
  direction: PushDirection,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const source = addPositions(pistonPosition, direction)
    const destination = addPositions(source, direction)
    const sourceBlock = yield* readBlock(services, source)
    if (sourceBlock === null || !isPistonMovableBlock(sourceBlock)) return

    const destinationBlock = yield* readBlock(services, destination)
    if (destinationBlock !== 'AIR') return

    const placed = yield* forceSetBlockSafely(services, destination, sourceBlock)
    if (!placed) return

    const cleared = yield* forceSetBlockSafely(services, source, 'AIR')
    if (!cleared) {
      yield* forceSetBlockSafely(services, destination, 'AIR')
      return
    }

    yield* markChunkDirty(refs, services, source)
    yield* markChunkDirty(refs, services, destination)
  })

export const applyPistonWorldEffects = (
  services: RedstonePistonWorldServices,
  refs: RedstonePistonWorldRefs,
  beforeComponents: ReadonlyArray<RedstoneComponent>,
  afterComponents: ReadonlyArray<RedstoneComponent>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const beforePistons = new Map<string, RedstoneComponent>()
    for (const component of beforeComponents) {
      if (component.type === RedstoneComponentType.Piston) {
        beforePistons.set(redstonePositionKey(component.position), component)
      }
    }

    for (const component of afterComponents) {
      if (component.type !== RedstoneComponentType.Piston) continue
      if (!component.state.pistonExtended) continue
      const previous = beforePistons.get(redstonePositionKey(component.position))
      if (previous?.state.pistonExtended === true) continue
      yield* pushSingleBlock(
        services,
        refs,
        component.position,
        PISTON_PUSH_DIRECTIONS[component.state.pistonFacing ?? 'east'],
      )
    }
  })
