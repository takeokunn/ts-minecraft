import { Vector3, parseUnitInterval, parseVector3, unitInterval } from '@domain/physics/types/core'
import type { PhysicsError } from '@domain/physics/types/errors'
import { Effect, Match, Schema, pipe } from 'effect'

const FluidKindSchema = Schema.Literal('none', 'water', 'lava')

export type FluidKind = Schema.Schema.Type<typeof FluidKindSchema>

const FluidStateSchema = Schema.Struct({
  kind: FluidKindSchema,
  immersion: Schema.Number.pipe(Schema.between(0, 1)),
  resistance: Schema.Number.pipe(Schema.between(0, 1)),
  buoyancy: Schema.Number,
}).pipe(Schema.brand('FluidState'))

export type FluidState = Schema.Schema.Type<typeof FluidStateSchema>

const create = (params: {
  readonly kind: FluidKind
  readonly immersion: number
  readonly resistance: number
  readonly buoyancy: number
}): Effect.Effect<FluidState, PhysicsError> =>
  Effect.gen(function* () {
    const immersion = yield* parseUnitInterval(params.immersion)
    const resistance = yield* parseUnitInterval(params.resistance)
    const buoyancy = Number(params.buoyancy)

    return {
      kind: params.kind,
      immersion,
      resistance,
      buoyancy,
      _tag: 'FluidState',
    }
  })

const presets: Record<FluidKind, () => Effect.Effect<FluidState, PhysicsError>> = {
  none: () =>
    create({
      kind: 'none',
      immersion: unitInterval(0),
      resistance: unitInterval(1),
      buoyancy: 0,
    }),
  water: () =>
    create({
      kind: 'water',
      immersion: unitInterval(1),
      resistance: unitInterval(0.6),
      buoyancy: 0.02,
    }),
  lava: () =>
    create({
      kind: 'lava',
      immersion: unitInterval(1),
      resistance: unitInterval(0.4),
      buoyancy: 0.01,
    }),
}

const FluidKindValue: Record<'none' | 'water' | 'lava', FluidKind> = {
  none: 'none',
  water: 'water',
  lava: 'lava',
}

const classify = (blockId: number | null): FluidKind =>
  pipe(
    blockId,
    Match.value,
    Match.when(
      (value) => value === null,
      () => FluidKindValue.none
    ),
    Match.when(
      (value) => value === 8 || value === 9,
      () => FluidKindValue.water
    ),
    Match.when(
      (value) => value === 10 || value === 11,
      () => FluidKindValue.lava
    ),
    Match.orElse(() => FluidKindValue.none)
  )

const blend = (
  headKind: FluidKind,
  feetKind: FluidKind,
  headLevel: number,
  feetLevel: number
): Effect.Effect<FluidState, PhysicsError> =>
  Effect.gen(function* () {
    const immersionValue = yield* parseUnitInterval(Math.max(feetLevel, headLevel))
    const feetPreset = yield* presets[feetKind]()
    const selectedPreset = yield* presets[feetKind === 'none' ? headKind : feetKind]()

    return yield* create({
      kind: feetKind === 'none' ? headKind : feetKind,
      immersion: immersionValue,
      resistance: feetKind === 'none' ? unitInterval(1) : feetPreset.resistance,
      buoyancy: selectedPreset.buoyancy,
    })
  })

const calculate = (params: {
  readonly headBlock: number | null
  readonly feetBlock: number | null
  readonly headLevel: number
  readonly feetLevel: number
}): Effect.Effect<FluidState, PhysicsError> =>
  Effect.gen(function* () {
    const headKind = classify(params.headBlock)
    const feetKind = classify(params.feetBlock)
    return yield* blend(headKind, feetKind, params.headLevel, params.feetLevel)
  })

const applyResistance = (fluidState: FluidState, velocity: Vector3): Effect.Effect<Vector3, PhysicsError> =>
  pipe(
    {
      x: velocity.x * fluidState.resistance,
      y: velocity.y * fluidState.resistance + fluidState.buoyancy,
      z: velocity.z * fluidState.resistance,
    },
    parseVector3
  )

const isInFluid = (state: FluidState): boolean => state.kind !== 'none' && state.immersion > 0

const isFullySubmerged = (state: FluidState): boolean => state.kind !== 'none' && state.immersion >= 1

export const FluidState = {
  schema: FluidStateSchema,
  create,
  presets: {
    none: presets.none,
    water: presets.water,
    lava: presets.lava,
  },
  classify,
  blend,
  calculate,
  applyResistance,
  isInFluid,
  isFullySubmerged,
}
