import { describe, expect, it } from '@effect/vitest'
import { Either, Schema } from 'effect'
import {
  BlockIdSchema,
  BlockPositionSchema,
  BlockTypeIdSchema,
  BrandedTypes,
  ComponentTypeNameSchema,
  EntityCapacitySchema,
  EntityCountSchema,
  EntityIdSchema,
  PlayerAbilitiesSchema,
  PlayerIdSchema,
  PlayerStatsSchema,
  RotationSchema,
  Vector3Schema,
} from '../core'

describe('entities/types/core', () => {
  it('EntityIdSchema accepts canonical identifiers', () => {
    expect(Either.isRight(Schema.decodeUnknownEither(EntityIdSchema)('entity_test'))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(EntityIdSchema)(''))).toBe(true)
  })

  it('BrandedTypes helpers yield schema-conformant values', () => {
    const entityId = BrandedTypes.createEntityId('entity_alpha')
    const blockId = BrandedTypes.createBlockId('minecraft:stone')
    const blockTypeId = BrandedTypes.createBlockTypeId(1)
    const component = BrandedTypes.createComponentTypeName('physics:velocity')
    const vector = BrandedTypes.createVector3D(1, 2, 3)
    const rotation = BrandedTypes.createRotation(0, 90, 0)

    expect(Either.isRight(Schema.decodeUnknownEither(EntityIdSchema)(entityId))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(BlockIdSchema)(blockId))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(BlockTypeIdSchema)(blockTypeId))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(ComponentTypeNameSchema)(component))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(Vector3Schema)(vector))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(RotationSchema)(rotation))).toBe(true)
  })

  it('RotationSchema rejects values outside allowed range', () => {
    const result = Schema.decodeUnknownEither(RotationSchema)({ pitch: 200, yaw: 0, roll: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('BlockPositionSchema enforces integral coordinates', () => {
    expect(
      Either.isRight(
        Schema.decodeUnknownEither(BlockPositionSchema)({ x: 1, y: 64, z: -5 })
      )
    ).toBe(true)
    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(BlockPositionSchema)({ x: 0.5, y: 64, z: -5 })
      )
    ).toBe(true)
  })

  it('EntityCount and EntityCapacity enforce numeric invariants', () => {
    expect(Either.isRight(Schema.decodeUnknownEither(EntityCountSchema)(10))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(EntityCountSchema)(-1))).toBe(true)
    expect(Either.isRight(Schema.decodeUnknownEither(EntityCapacitySchema)(5))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(EntityCapacitySchema)(0))).toBe(true)
  })

  it('Player schemas validate domain rules', () => {
    const statsResult = Schema.decodeUnknownEither(PlayerStatsSchema)({
      health: 10,
      maxHealth: 20,
      hunger: 20,
      saturation: 10,
      experience: 0,
      level: 0,
      armor: 5,
    })
    expect(Either.isRight(statsResult)).toBe(true)

    const abilitiesResult = Schema.decodeUnknownEither(PlayerAbilitiesSchema)({
      canFly: false,
      isFlying: false,
      canBreakBlocks: true,
      canPlaceBlocks: true,
      invulnerable: false,
      walkSpeed: 0.1,
      flySpeed: 0.5,
    })
    expect(Either.isRight(abilitiesResult)).toBe(true)

    const invalidAbilities = Schema.decodeUnknownEither(PlayerAbilitiesSchema)({
      canFly: false,
      isFlying: false,
      canBreakBlocks: true,
      canPlaceBlocks: true,
      invulnerable: false,
      walkSpeed: 0,
      flySpeed: 0.5,
    })
    expect(Either.isLeft(invalidAbilities)).toBe(true)
  })

  it('PlayerIdSchema enforces branded identifier', () => {
    expect(Either.isRight(Schema.decodeUnknownEither(PlayerIdSchema)('player_123'))).toBe(true)
    expect(Either.isLeft(Schema.decodeUnknownEither(PlayerIdSchema)(''))).toBe(true)
  })
})
