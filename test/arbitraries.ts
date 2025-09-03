import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import * as fc from 'effect/FastCheck'
import { AABBSchema } from '@/domain/geometry'
import { EntityIdSchema } from '@/domain/entity'
import { BlockTypeSchema } from '@/domain/block-types'
import {
  Position,
  Velocity,
  InputState,
  CameraState,
  Hotbar,
  Target,
  TargetBlock,
  TargetNone,
  ComponentName,
  ComponentSchemas,
  AnyComponent,
  Player,
  Collider,
  Chunk,
} from '@/domain/components'
import { ChunkX, ChunkZ, Int, Vector3IntSchema } from '@/domain/common'
import { type ArchetypeBuilder } from '@/domain/archetypes'

// Existing arbitraries
export const EntityIdArb = Arbitrary.make(EntityIdSchema)
export const AABBArb = Arbitrary.make(AABBSchema)

// Primitive arbitraries
export const IntArb = Arbitrary.make(Int)
export const Vector3IntArb = Arbitrary.make(Vector3IntSchema)

// Component arbitraries
export const PositionArb = Arbitrary.make(Position)
export const VelocityArb = Arbitrary.make(Velocity)
export const InputStateArb = Arbitrary.make(InputState)
export const CameraStateArb = Arbitrary.make(CameraState)
export const BlockTypeArb = Arbitrary.make(BlockTypeSchema)
export const TargetBlockArb = Arbitrary.make(TargetBlock)
export const TargetNoneArb = Arbitrary.make(TargetNone)
export const TargetArb = Arbitrary.make(Target)
export const HotbarArb = Arbitrary.make(Hotbar)
export const PlayerArb = Arbitrary.make(Player)
export const ColliderArb = Arbitrary.make(Collider)
export const ChunkArb = Arbitrary.make(Chunk)

// --- Aliases for convenience ---
export const arbitraryInputState = InputStateArb
export const arbitraryTarget = TargetArb
export const arbitraryHotbar = HotbarArb
export const arbitraryPlayer = PlayerArb
export const arbitraryVelocity = VelocityArb
export const arbitraryCollider = ColliderArb
export const arbitraryCameraState = CameraStateArb
export const arbitraryPosition = PositionArb
export const arbitraryChunk = ChunkArb
export const arbitraryEntityId = EntityIdArb
export const arbitraryBlockType = BlockTypeArb

export const ComponentNameArb = fc.constantFrom(
  ...(Object.keys(ComponentSchemas) as ReadonlyArray<ComponentName>),
)

export const ComponentArb = ComponentNameArb.chain((name) =>
  Arbitrary.make(ComponentSchemas[name]).map((component) => [name, component] as const),
) as fc.Arbitrary<readonly [ComponentName, AnyComponent]>

// ArchetypeBuilder arbitrary
export const ArchetypeBuilderArb: fc.Arbitrary<ArchetypeBuilder> = fc.oneof(
  fc.record({
    type: fc.constant('player' as const),
    pos: PositionArb,
    cameraState: fc.option(CameraStateArb, { nil: undefined }),
  }),
  fc.record({
    type: fc.constant('block' as const),
    pos: PositionArb,
    blockType: BlockTypeArb,
  }),
  fc.record({
    type: fc.constant('camera' as const),
    pos: PositionArb,
  }),
  fc.record({
    type: fc.constant('targetBlock' as const),
    pos: PositionArb,
  }),
  fc.record({
    type: fc.constant('chunk' as const),
    chunkX: IntArb,
    chunkZ: IntArb,
  }),
)