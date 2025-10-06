import { MATERIAL_FRICTION } from '@domain/physics/types/constants'
import {
  PhysicsMaterialSchema,
  UnitInterval,
  Vector3,
  parseUnitInterval,
  parseVector3,
  vector3,
} from '@domain/physics/types/core'
import type { PhysicsError } from '@domain/physics/types/errors'
import { Effect, Match, Schema, pipe } from 'effect'

const FrictionSchema = Schema.Struct({
  material: Schema.suspend(() => PhysicsMaterialSchema),
  coefficient: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(Schema.brand('FrictionCoefficient'))

export type FrictionCoefficient = Schema.Schema.Type<typeof FrictionSchema>

const create = (
  material: Schema.Schema.Type<typeof PhysicsMaterialSchema>,
  raw: unknown
): Effect.Effect<FrictionCoefficient, PhysicsError> =>
  Effect.gen(function* () {
    const coefficient = yield* parseUnitInterval(raw)
    return {
      material,
      coefficient,
      _tag: 'FrictionCoefficient',
    }
  })

// Factory関数化してruntime初期化問題を回避
const createFromMaterial = (material: Schema.Schema.Type<typeof PhysicsMaterialSchema>): FrictionCoefficient => {
  const frictionValue = MATERIAL_FRICTION[material]
  return Effect.runSync(create(material, frictionValue !== undefined ? frictionValue : 0.5))
}

const fromMaterial = createFromMaterial

const mix = (surface: FrictionCoefficient, modifier: UnitInterval): Effect.Effect<FrictionCoefficient, PhysicsError> =>
  Effect.map(parseUnitInterval(surface.coefficient * modifier), (coefficient) => ({
    material: surface.material,
    coefficient,
    _tag: 'FrictionCoefficient',
  }))

const apply = (
  friction: FrictionCoefficient,
  velocity: Vector3,
  input: Vector3
): Effect.Effect<Vector3, PhysicsError> =>
  pipe(
    friction.coefficient,
    Match.value,
    Match.when(
      (coeff) => coeff > 0.95,
      () =>
        parseVector3({
          x: velocity.x * friction.coefficient,
          y: velocity.y,
          z: velocity.z * friction.coefficient,
        })
    ),
    Match.when(
      (coeff) => coeff < 0.1,
      () =>
        parseVector3({
          x: velocity.x * friction.coefficient + input.x * 0.05,
          y: velocity.y,
          z: velocity.z * friction.coefficient + input.z * 0.05,
        })
    ),
    Match.orElse(() =>
      parseVector3({
        x: input.x,
        y: velocity.y,
        z: input.z,
      })
    )
  )

const clampHorizontal = (velocity: Vector3, maxSpeed: number): Vector3 =>
  pipe(
    Math.hypot(velocity.x, velocity.z),
    Match.value,
    Match.when(
      (speed) => speed <= maxSpeed,
      () => velocity
    ),
    Match.orElse((speed) =>
      vector3({
        x: velocity.x * (maxSpeed / speed),
        y: velocity.y,
        z: velocity.z * (maxSpeed / speed),
      })
    )
  )

export const FrictionCoefficient = {
  schema: FrictionSchema,
  create,
  fromMaterial,
  mix,
  apply,
  clampHorizontal,
}
