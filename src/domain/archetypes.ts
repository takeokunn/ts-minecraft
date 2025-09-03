import { Effect, Match } from 'effect'
import * as S from 'effect/Schema'
import { hotbarSlots } from './block'
import { BlockTypeSchema } from './block-types'
import {
  Camera,
  CameraState,
  Chunk,
  type Components,
  Gravity,
  Hotbar,
  InputState,
  Player,
  Position,
  Renderable,
  TargetBlockComponent,
  TargetNone,
  TerrainBlock,
  Velocity,
} from './components'
import { Int } from './common'
import {
  BLOCK_COLLIDER,
  GRAVITY,
  PLAYER_COLLIDER,
} from './world-constants'

const PlayerArchetypeBuilder = S.Struct({
  type: S.Literal('player'),
  pos: Position,
  cameraState: S.withDefault(S.optional(CameraState), () => ({ pitch: 0, yaw: 0 })),
})

const BlockArchetypeBuilder = S.Struct({
  type: S.Literal('block'),
  pos: Position,
  blockType: BlockTypeSchema,
})

const CameraArchetypeBuilder = S.Struct({
  type: S.Literal('camera'),
  pos: Position,
})

const TargetBlockArchetypeBuilder = S.Struct({
  type: S.Literal('targetBlock'),
  pos: Position,
})

const ChunkArchetypeBuilder = S.Struct({
  type: S.Literal('chunk'),
  chunkX: Int,
  chunkZ: Int,
})

const ArchetypeBuilder = S.Union(
  PlayerArchetypeBuilder,
  BlockArchetypeBuilder,
  CameraArchetypeBuilder,
  TargetBlockArchetypeBuilder,
  ChunkArchetypeBuilder,
)
type ArchetypeBuilder = S.Schema.Type<typeof ArchetypeBuilder>

/**
 * An archetype is a template for creating an entity, defined as a partial set of components.
 */
export type Archetype = Partial<Components>

export const createInputState = (): Effect.Effect<InputState> => Effect.succeed({
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
export const createArchetype = (builder: ArchetypeBuilder): Effect.Effect<Archetype> => {
  return Effect.gen(function* (_) {
    const inputState = yield* _(createInputState())

    return yield* _(
      Match.value(builder).pipe(
        Match.when({ type: 'player' }, ({ pos, cameraState }) =>
          Effect.all({
            player: Effect.succeed({ isGrounded: false } as Player),
            position: Effect.succeed(pos),
            velocity: Effect.succeed({ dx: 0, dy: 0, dz: 0 } as Velocity),
            gravity: Effect.succeed({ value: GRAVITY } as Gravity),
            cameraState: Effect.succeed(cameraState),
            inputState: Effect.succeed(inputState),
            collider: PLAYER_COLLIDER,
            hotbar: Effect.succeed({ slots: hotbarSlots, selectedIndex: 0 } as Hotbar),
            target: Effect.succeed({ _tag: 'none' } as TargetNone),
          }),
        ),
        Match.when({ type: 'block' }, ({ pos, blockType }) =>
          Effect.all({
            position: Effect.succeed(pos),
            renderable: Effect.succeed({ geometry: 'box', blockType } as Renderable),
            collider: BLOCK_COLLIDER,
            terrainBlock: Effect.succeed({} as TerrainBlock),
          }),
        ),
        Match.when({ type: 'camera' }, ({ pos }) =>
          Effect.all({
            camera: Effect.succeed({
              position: pos,
              damping: 0.1,
            } as Camera),
            position: Effect.succeed(pos),
          }),
        ),
        Match.when({ type: 'targetBlock' }, ({ pos }) =>
          Effect.all({
            position: Effect.succeed(pos),
            targetBlock: Effect.succeed({} as TargetBlockComponent),
          }),
        ),
        Match.when({ type: 'chunk' }, ({ chunkX, chunkZ }) =>
          Effect.all({
            chunk: Effect.succeed({ chunkX, chunkZ, blocks: [] } as Chunk),
          }),
        ),
        Match.exhaustive,
      ),
    )
  })
}