import { Array, Context, Effect, Layer, Random, Ref, pipe } from 'effect'
import { CraftingGrid } from '../types'
import { CraftingEngineService } from '../application_service/crafting-engine'
import { RecipeAggregate } from '../aggregate/recipe'

export interface CraftingSession {
  readonly sessionId: string
  readonly registered: ReadonlyArray<RecipeAggregate>
}

export interface CraftingSessionFactory {
  readonly create: (
    recipes: ReadonlyArray<RecipeAggregate>,
    engine: CraftingEngineService
  ) => Effect.Effect<CraftingSession, never>

  readonly evaluate: (
    session: CraftingSession,
    grid: CraftingGrid,
    engine: CraftingEngineService
  ) => Effect.Effect<boolean, never>
}

export const CraftingSessionFactory = Context.GenericTag<CraftingSessionFactory>(
  '@minecraft/domain/crafting/CraftingSessionFactory'
)

const generateSessionId = (): Effect.Effect<string, never> =>
  pipe(
    Random.nextIntBetween(100_000, 9_999_999),
    Effect.map((value) => `session-${value}`)
  )

export const CraftingSessionFactoryLive = Layer.effect(
  CraftingSessionFactory,
  Effect.gen(function* () {
    const create: CraftingSessionFactory['create'] = (recipes, _engine) =>
      Effect.map(generateSessionId(), (sessionId) => ({
        sessionId,
        registered: Array.from(recipes),
      }))

    const evaluate: CraftingSessionFactory['evaluate'] = (session, grid, engine) =>
      pipe(
        engine.matchAggregate(session.registered, grid),
        Effect.map(Option.isSome)
      )

    return {
      create,
      evaluate,
    }
  })
)
