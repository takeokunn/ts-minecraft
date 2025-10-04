import { Context, Effect, Layer, Match, pipe } from 'effect'
import type { PhysicsError } from '../types/errors'
import type { FluidState as FluidStateState } from '../value_object/fluid_state'
import { FluidState } from '../value_object/fluid_state'

export interface TerrainContext {
  readonly feetBlock: number | null
  readonly bodyBlock: number | null
  readonly belowBlock: number | null
  readonly fluid: FluidStateState
}

export interface TerrainAnalysis {
  readonly surface: 'air' | 'solid' | 'liquid'
  readonly movementMultiplier: number
  readonly canJump: boolean
  readonly canStep: boolean
  readonly breathingDifficulty: number
}

export interface TerrainAdaptationService {
  readonly analyze: (context: TerrainContext) => Effect.Effect<TerrainAnalysis, PhysicsError>
}

const Surface: Record<'air' | 'solid' | 'liquid', TerrainAnalysis['surface']> = {
  air: 'air',
  solid: 'solid',
  liquid: 'liquid',
}

const isSolid = (block: number | null): boolean =>
  pipe(
    block,
    Match.value,
    Match.when(
      (value) => value === null,
      () => false
    ),
    Match.when(
      (value) => value === 0,
      () => false
    ),
    Match.orElse(() => true)
  )

const classifySurface = (context: TerrainContext): 'air' | 'solid' | 'liquid' =>
  pipe(
    FluidState.isInFluid(context.fluid),
    Match.value,
    Match.when(true, () => Surface.liquid),
    Match.orElse(() => (isSolid(context.feetBlock) ? Surface.solid : Surface.air))
  )

export const TerrainAdaptationService = Context.GenericTag<TerrainAdaptationService>(
  '@minecraft/physics/TerrainAdaptationService'
)

export const TerrainAdaptationServiceLive = Layer.succeed(TerrainAdaptationService, {
  analyze: (context) =>
    Effect.succeed({
      surface: classifySurface(context),
      movementMultiplier: pipe(
        FluidState.isInFluid(context.fluid),
        Match.value,
        Match.when(true, () => 0.4),
        Match.orElse(() => (isSolid(context.feetBlock) ? 1 : 0.9))
      ),
      canJump: !FluidState.isInFluid(context.fluid) ? isSolid(context.belowBlock) : true,
      canStep: !isSolid(context.bodyBlock),
      breathingDifficulty: FluidState.isFullySubmerged(context.fluid) ? 1 : 0,
    }),
})
