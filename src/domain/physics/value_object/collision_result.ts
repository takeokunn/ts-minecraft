import {
  AABB,
  Vector3,
  Vector3Schema,
  parseAABB,
  parsePositiveFloat,
  parseVector3,
  vector3,
} from '@domain/physics/types/core'
import type { PhysicsError } from '@domain/physics/types/errors'
import { Effect, Match, Schema, pipe } from 'effect'

const CollidedAxesSchema = Schema.Struct({
  x: Schema.Boolean,
  y: Schema.Boolean,
  z: Schema.Boolean,
}).pipe(Schema.brand('CollidedAxes'))

export type CollidedAxes = Schema.Schema.Type<typeof CollidedAxesSchema>

const CollisionResultSchema = Schema.Struct({
  position: Schema.suspend(() => Vector3Schema),
  velocity: Schema.suspend(() => Vector3Schema),
  collidedAxes: CollidedAxesSchema,
  isGrounded: Schema.Boolean,
  contactNormal: Schema.suspend(() => Vector3Schema),
  penetration: Schema.Number.pipe(Schema.nonNegative()),
}).pipe(Schema.brand('CollisionResult'))

export type CollisionResult = Schema.Schema.Type<typeof CollisionResultSchema>

const intersects = (a: AABB, b: AABB): boolean => {
  const overlaps = (minA: number, maxA: number, minB: number, maxB: number) =>
    minA <= maxB + Number.EPSILON && maxA >= minB - Number.EPSILON

  return (
    overlaps(a.min.x, a.max.x, b.min.x, b.max.x) &&
    overlaps(a.min.y, a.max.y, b.min.y, b.max.y) &&
    overlaps(a.min.z, a.max.z, b.min.z, b.max.z)
  )
}

const translate = (box: AABB, offset: Vector3): Effect.Effect<AABB, PhysicsError> =>
  parseAABB({
    min: {
      x: box.min.x + offset.x,
      y: box.min.y + offset.y,
      z: box.min.z + offset.z,
    },
    max: {
      x: box.max.x + offset.x,
      y: box.max.y + offset.y,
      z: box.max.z + offset.z,
    },
  })

const detect = (params: {
  readonly position: Vector3
  readonly velocity: Vector3
  readonly deltaTime: unknown
  readonly body: AABB
  readonly sample: (query: AABB) => ReadonlyArray<AABB>
}): Effect.Effect<CollisionResult, PhysicsError> =>
  Effect.gen(function* () {
    const deltaTime = yield* parsePositiveFloat(params.deltaTime)

    const candidatePosition = yield* parseVector3({
      x: params.position.x + params.velocity.x * deltaTime,
      y: params.position.y + params.velocity.y * deltaTime,
      z: params.position.z + params.velocity.z * deltaTime,
    })

    const candidateBox = yield* translate(params.body, {
      x: candidatePosition.x - params.position.x,
      y: candidatePosition.y - params.position.y,
      z: candidatePosition.z - params.position.z,
    })

    const colliders = params.sample(candidateBox).filter((block) => intersects(candidateBox, block))

    const collisionCount = colliders.length

    const axisEntries = [
      { axis: 'x', velocity: params.velocity.x },
      { axis: 'y', velocity: params.velocity.y },
      { axis: 'z', velocity: params.velocity.z },
    ] satisfies ReadonlyArray<{ readonly axis: keyof CollidedAxes; readonly velocity: number }>

    let collidedAxes = pipe(axisEntries, (axes) =>
      axes.reduce<CollidedAxes>(
        (state, entry) =>
          pipe(
            collisionCount,
            Match.value,
            Match.when(
              (count) => count === 0,
              () => state
            ),
            Match.orElse(() =>
              pipe(
                entry.velocity,
                Match.value,
                Match.when(
                  (component) => component === 0,
                  () => state
                ),
                Match.orElse(() => ({
                  ...state,
                  [entry.axis]: true,
                }))
              )
            )
          ),
        { x: false, y: false, z: false }
      )
    )

    if (collisionCount > 0 && !collidedAxes.x && !collidedAxes.y && !collidedAxes.z) {
      collidedAxes = { x: true, y: true, z: true }
    }

    const resolvedPosition = pipe(
      collisionCount,
      Match.value,
      Match.when(
        (count) => count === 0,
        () => candidatePosition
      ),
      Match.orElse(() => params.position)
    )

    const resolvedVelocity = pipe(
      collisionCount,
      Match.value,
      Match.when(
        (count) => count === 0,
        () => params.velocity
      ),
      Match.orElse(() => vector3({ x: 0, y: 0, z: 0 }))
    )

    const contactNormal = yield* pipe(
      collidedAxes.y,
      Match.value,
      Match.when(
        (flag) => flag,
        () => parseVector3({ x: 0, y: 1, z: 0 })
      ),
      Match.orElse(() =>
        pipe(
          collidedAxes.x,
          Match.value,
          Match.when(
            (flag) => flag,
            () => parseVector3({ x: Math.sign(params.velocity.x) * -1, y: 0, z: 0 })
          ),
          Match.orElse(() =>
            pipe(
              collidedAxes.z,
              Match.value,
              Match.when(
                (flag) => flag,
                () => parseVector3({ x: 0, y: 0, z: Math.sign(params.velocity.z) * -1 })
              ),
              Match.orElse(() => parseVector3({ x: 0, y: 0, z: 0 }))
            )
          )
        )
      )
    )

    return {
      position: resolvedPosition,
      velocity: resolvedVelocity,
      collidedAxes,
      isGrounded: collidedAxes.y,
      contactNormal,
      penetration: 0,
      _tag: 'CollisionResult',
    }
  })

export const CollisionResult = {
  schema: CollisionResultSchema,
  detect,
  intersects,
  translate,
}
