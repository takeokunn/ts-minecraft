import { Effect, Match } from 'effect'
import * as S from "/schema/Schema"
import { hotbarSlots } from './block'
import { BlockTypeSchema } from './block-types'
import { 
  CameraComponent, 
  type PartialComponents, 
  PositionComponent, 
  PartialComponentsSchema 
} from '@/domain/entities/components'
import { ChunkX, ChunkZ, toFloat, toInt } from './common'
import { BLOCK_COLLIDER, GRAVITY, PLAYER_COLLIDER } from './world-constants'
import * as ParseResult from '@effect/schema/ParseResult'

const PlayerArchetypeBuilder = S.Struct({
  type: S.Literal('player'),
  pos: PositionComponent,
  cameraState: S.optional(CameraComponent),
})

const BlockArchetypeBuilder = S.Struct({
  type: S.Literal('block'),
  pos: PositionComponent,
  blockType: BlockTypeSchema,
})

const CameraArchetypeBuilder = S.Struct({
  type: S.Literal('camera'),
  pos: PositionComponent,
})

const TargetBlockArchetypeBuilder = S.Struct({
  type: S.Literal('targetBlock'),
  pos: PositionComponent,
})

const ChunkArchetypeBuilder = S.Struct({
  type: S.Literal('chunk'),
  chunkX: ChunkX,
  chunkZ: ChunkZ,
})

export const ArchetypeBuilder = S.Union(
  PlayerArchetypeBuilder,
  BlockArchetypeBuilder,
  CameraArchetypeBuilder,
  TargetBlockArchetypeBuilder,
  ChunkArchetypeBuilder,
)
export type ArchetypeBuilder = S.Schema.Type<typeof ArchetypeBuilder>

/**
 * An archetype is a template for creating an entity, defined as a partial set of components.
 */
export const ArchetypeSchema = PartialComponentsSchema
export type Archetype = PartialComponents

export const createInputState = () => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  place: false,
  destroy: false,
  isLocked: false,
})

/**
 * Creates an archetype object based on the provided builder.
 * @param builder - The archetype builder specifying the type and parameters.
 * @returns An archetype object (a partial set of components).
 */
export const createArchetype = (builder: ArchetypeBuilder): Effect.Effect<Archetype, ParseResult.ParseError, never> => {
  return Effect.gen(function* () {
    const decodedBuilder = yield* S.decodeUnknown(ArchetypeBuilder)(builder)
    const inputState = createInputState()

    const archetype: Archetype = Match.value(decodedBuilder).pipe(
      Match.when({ type: 'player' }, ({ pos, cameraState }) => ({
        player: { isGrounded: false },
        position: pos,
        velocity: { dx: toFloat(0), dy: toFloat(0), dz: toFloat(0) },
        gravity: { value: toFloat(GRAVITY) },
        cameraState: cameraState ?? { pitch: toFloat(0), yaw: toFloat(0) },
        inputState: inputState,
        collider: PLAYER_COLLIDER,
        hotbar: { slots: hotbarSlots, selectedIndex: toInt(0) },
        target: { _tag: 'none' as const },
      })),
      Match.when({ type: 'block' }, ({ pos, blockType }) => ({
        position: pos,
        renderable: { geometry: 'box', blockType },
        collider: BLOCK_COLLIDER,
        terrainBlock: {},
      })),
      Match.when({ type: 'camera' }, ({ pos }) => ({
        camera: {
          position: pos,
          damping: toFloat(0.1),
        },
        position: pos,
      })),
      Match.when({ type: 'targetBlock' }, ({ pos }) => ({
        position: pos,
        targetBlock: {},
      })),
      Match.when({ type: 'chunk' }, ({ chunkX, chunkZ }) => ({
        chunk: { chunkX, chunkZ, blocks: [] },
      })),
      Match.exhaustive,
    )
    return archetype
  })
}
