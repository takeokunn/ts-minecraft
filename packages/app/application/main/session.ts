import { Effect, Option } from 'effect'
import { type GameMode } from '@ts-minecraft/game'
import type { WorldOpenRequest } from '@ts-minecraft/app/main/session-world-loader'

import { runSessionLifecycle } from '@ts-minecraft/app/main/session-lifecycle'
import { buildSessionBootstrapOrchestration } from '@ts-minecraft/app/main/session-bootstrap-orchestration'
import { buildSessionBootstrapDeps } from '@ts-minecraft/app/main/session-bootstrap-deps'
import type { SessionBootstrapStartupMultiplayerConnection } from '@ts-minecraft/app/main/session-bootstrap-types/core'

import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'

export type SessionResult = {
  readonly reason: 'quit-to-title' | 'never-returned'
  readonly control: SessionControl
}

export const sessionProgram = (
  bootCtx: BootContext,
  worldOpenRequest: WorldOpenRequest,
  initialGameMode: GameMode,
  startupMultiplayerConnection: SessionBootstrapStartupMultiplayerConnection = Option.none(),
) =>
  Effect.gen(function* () {
    const bootstrapDeps = yield* buildSessionBootstrapDeps(
      bootCtx,
      worldOpenRequest,
      initialGameMode,
      startupMultiplayerConnection,
    )
    const bootstrap = yield* buildSessionBootstrapOrchestration(bootstrapDeps)

    return yield* runSessionLifecycle(bootstrap)
  })
