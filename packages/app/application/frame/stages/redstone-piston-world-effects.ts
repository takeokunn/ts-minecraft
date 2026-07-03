import { Effect, HashMap, MutableRef, Option } from 'effect'
import type { BlockType, Position } from '@ts-minecraft/core'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { RedstoneComponentType, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import { worldToChunkCoord } from '@ts-minecraft/world/domain/chunk-coord-utils'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'

export type RedstonePistonWorldServices = Pick<FrameHandlerServices, 'blockService' | 'chunkManagerService' | 'entityManager' | 'gameState'>
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
  'PISTON_HEAD',
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
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
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

// Vanilla pushes trains of up to 12 blocks: scan along the facing collecting
// contiguous movable blocks; the run must terminate in AIR within the limit
// and contain no immovable block, then the whole train shifts one cell
// (written far-end first so nothing is overwritten mid-shift).
const PISTON_MAX_PUSH = 12
// Entity shove on extension: mobs standing in the swept head cell get an
// impulse along the facing (vanilla pistons push entities). Matches the
// knockback speeds used by melee so the shove reads consistently.
const PISTON_SHOVE_SPEED = 5
const PISTON_SHOVE_LIFT = 1.5
const ENTITY_HALF_WIDTH = 0.3
const ENTITY_HALF_HEIGHT = 0.9

const pushBlockTrain = (
  services: RedstonePistonWorldServices,
  refs: RedstonePistonWorldRefs,
  pistonPosition: Position,
  direction: PushDirection,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const train: Array<{ readonly cell: Position; readonly blockType: BlockType }> = []
    let cursor = addPositions(pistonPosition, direction)

    while (train.length <= PISTON_MAX_PUSH) {
      const blockType = yield* readBlock(services, cursor)
      if (blockType === null) return // unreadable world edge — blocked
      if (blockType === 'AIR') break // room to push into
      if (!isPistonMovableBlock(blockType)) return // immovable in the run — blocked
      train.push({ cell: cursor, blockType })
      cursor = addPositions(cursor, direction)
    }
    if (train.length === 0) return // nothing in front (arm placement handles the empty head)
    if (train.length > PISTON_MAX_PUSH) return // vanilla limit exceeded — blocked

    // Shift far-end first: cursor is the AIR cell past the train.
    let writeCell = cursor
    for (let i = train.length - 1; i >= 0; i--) {
      const placed = yield* forceSetBlockSafely(services, writeCell, train[i]!.blockType)
      if (!placed) return
      yield* markChunkDirty(refs, services, writeCell)
      writeCell = train[i]!.cell
    }
    const cleared = yield* forceSetBlockSafely(services, train[0]!.cell, 'AIR')
    if (cleared) yield* markChunkDirty(refs, services, train[0]!.cell)
  })

// Sticky-style retraction: on the falling edge, the block sitting one cell
// past the piston head is pulled back into the head cell. Mirrors
// pushSingleBlock with source/destination swapped along the facing.
const pullSingleBlock = (
  services: RedstonePistonWorldServices,
  refs: RedstonePistonWorldRefs,
  pistonPosition: Position,
  direction: PushDirection,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const destination = addPositions(pistonPosition, direction)
    const source = addPositions(destination, direction)
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

// Shove any entity overlapping the given cell one step along the direction.
const shoveEntitiesInCell = (
  services: Pick<RedstonePistonWorldServices, 'entityManager'>,
  cell: Position,
  direction: PushDirection,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const entities = yield* services.entityManager.getEntities()
    for (const entity of entities) {
      const overlapsX = Math.abs(entity.position.x - (cell.x + 0.5)) < 0.5 + ENTITY_HALF_WIDTH
      const overlapsZ = Math.abs(entity.position.z - (cell.z + 0.5)) < 0.5 + ENTITY_HALF_WIDTH
      const overlapsY = entity.position.y + ENTITY_HALF_HEIGHT > cell.y && entity.position.y - ENTITY_HALF_HEIGHT < cell.y + 1
      if (!overlapsX || !overlapsY || !overlapsZ) continue
      yield* services.entityManager.applyKnockback(entity.entityId, {
        x: direction.x * PISTON_SHOVE_SPEED,
        y: Math.max(direction.y * PISTON_SHOVE_SPEED, PISTON_SHOVE_LIFT),
        z: direction.z * PISTON_SHOVE_SPEED,
      })
    }
  })

// The player rides a separate physics pipeline, so the shove is positional:
// overlap with the swept cell moves the player one cell along the facing.
const shovePlayerInCell = (
  services: Pick<RedstonePistonWorldServices, 'gameState'>,
  cell: Position,
  direction: PushDirection,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const playerPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (playerPos === null) return
    const overlapsX = Math.abs(playerPos.x - (cell.x + 0.5)) < 0.5 + ENTITY_HALF_WIDTH
    const overlapsZ = Math.abs(playerPos.z - (cell.z + 0.5)) < 0.5 + ENTITY_HALF_WIDTH
    const overlapsY = playerPos.y + ENTITY_HALF_HEIGHT > cell.y && playerPos.y - ENTITY_HALF_HEIGHT < cell.y + 1
    if (!overlapsX || !overlapsY || !overlapsZ) return
    yield* services.gameState.setPlayerPosition({
      x: playerPos.x + direction.x,
      y: playerPos.y + Math.max(direction.y, 0),
      z: playerPos.z + direction.z,
    }).pipe(Effect.catchAll(() => Effect.void))
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
      const previous = beforePistons.get(redstonePositionKey(component.position))
      const direction = PISTON_PUSH_DIRECTIONS[component.state.pistonFacing ?? 'east']

      const headCell = addPositions(component.position, direction)

      // Rising edge → push the block ahead one cell further, then extend the
      // arm into the freed head cell (the arm physically occupies it).
      if (component.state.pistonExtended && previous?.state.pistonExtended !== true) {
        yield* pushBlockTrain(services, refs, component.position, direction)
        const headBlock = yield* readBlock(services, headCell)
        if (headBlock === 'AIR') {
          const placed = yield* forceSetBlockSafely(services, headCell, 'PISTON_HEAD')
          if (placed) yield* markChunkDirty(refs, services, headCell)
        }
        yield* shoveEntitiesInCell(services, headCell, direction)
        yield* shovePlayerInCell(services, headCell, direction)
        continue
      }

      // Falling edge → withdraw the arm first, then pull the block back
      // (sticky-piston semantics) into the freed head cell.
      if (!component.state.pistonExtended && previous?.state.pistonExtended === true) {
        const headBlock = yield* readBlock(services, headCell)
        if (headBlock === 'PISTON_HEAD') {
          const cleared = yield* forceSetBlockSafely(services, headCell, 'AIR')
          if (cleared) yield* markChunkDirty(refs, services, headCell)
        }
        yield* pullSingleBlock(services, refs, component.position, direction)
      }
    }
  })
