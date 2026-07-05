import { Effect, Option } from 'effect'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import type { GameStateService } from '@ts-minecraft/game'

// Mob AI is otherwise only inferrable by watching positions over time. This
// reports each entity's live AI state (Idle/Wander/Chase/Flee/Attack) alongside
// its distance to the player, so aggro/pursuit bugs are one call instead of a
// multi-second position-sampling loop.
export type QaMobAi = {
  readonly playerPosition: { x: number; y: number; z: number } | null
  readonly mobs: ReadonlyArray<{
    readonly entityId: string
    readonly type: string
    readonly health: number
    readonly aiState: string | null
    readonly distanceToPlayer: number | null
    readonly position: { x: number; y: number; z: number }
  }>
}

type MobAiDeps = {
  readonly entityManager: EntityManager
  readonly gameState: GameStateService
}

export const getMobAiForQA = (deps: MobAiDeps): Promise<QaMobAi> =>
  Effect.runPromise(Effect.gen(function* () {
    const playerPosition = yield* deps.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
      Effect.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      Effect.catchAll(() => Effect.succeed(null)),
    )
    const entities = yield* deps.entityManager.getEntities()
    const mobs = yield* Effect.forEach(entities, (e) =>
      Effect.gen(function* () {
        const aiState = yield* deps.entityManager.getEntityAIState(e.entityId)
        const distanceToPlayer = playerPosition === null
          ? null
          : Math.round(Math.hypot(e.position.x - playerPosition.x, e.position.z - playerPosition.z) * 10) / 10
        return {
          entityId: String(e.entityId),
          type: e.type,
          health: e.health,
          aiState: Option.getOrNull(aiState),
          distanceToPlayer,
          position: { x: e.position.x, y: e.position.y, z: e.position.z },
        }
      }),
    )
    return { playerPosition, mobs }
  }))
