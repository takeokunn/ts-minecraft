import * as S from 'effect/Schema'
import * as Arbitrary from 'effect/Arbitrary'
import * as fc from 'effect/FastCheck'
import { AABBSchema, EntityIdSchema } from '@/domain/geometry'
import {
  Position,
  Velocity,
  InputState,
  CameraState,
  Hotbar,
  Target,
  BlockTypeSchema,
  TargetBlock,
  TargetNone,
  ComponentName,
  ComponentSchemas,
  Component,
} from '@/domain/components'
import { Int, Vector3Int } from '@/domain/common'
import { type ArchetypeBuilder } from '@/domain/archetypes'

// Existing arbitraries
export const EntityIdArb = Arbitrary.make(EntityIdSchema)(fc)
export const AABBArb = Arbitrary.make(AABBSchema)(fc)

// Primitive arbitraries
export const IntArb = Arbitrary.make(Int)(fc)
export const Vector3IntArb = Arbitrary.make(Vector3Int)(fc)

// Component arbitraries
export const PositionArb = Arbitrary.make(Position)(fc)
export const VelocityArb = Arbitrary.make(Velocity)(fc)
export const InputStateArb = Arbitrary.make(InputState)(fc)
export const CameraStateArb = Arbitrary.make(CameraState)(fc)
export const BlockTypeArb = Arbitrary.make(BlockTypeSchema)(fc)
export const TargetBlockArb = Arbitrary.make(TargetBlock)(fc)
export const TargetNoneArb = Arbitrary.make(TargetNone)(fc)
export const TargetArb = fc.oneof(TargetBlockArb, TargetNoneArb)
export const HotbarArb = Arbitrary.make(Hotbar)(fc)

export const ComponentNameArb = fc.constantFrom(
  ...(Object.keys(ComponentSchemas) as ReadonlyArray<ComponentName>),
)

export const ComponentArb = ComponentNameArb.chain((name) =>
  Arbitrary.make(ComponentSchemas[name])(fc).map((component) => [name, component] as const),
) as fc.Arbitrary<readonly [ComponentName, Component]>

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