import { Effect } from 'effect'
import { WorldId } from '@ts-minecraft/core'
import { type GameMode } from '@ts-minecraft/game'

import { runSessionLifecycle } from '@ts-minecraft/app/main/session-lifecycle'
import { buildSessionBootstrapOrchestration } from '@ts-minecraft/app/main/session-bootstrap-orchestration'
import { buildSessionBootstrapDeps } from '@ts-minecraft/app/main/session-bootstrap-deps'

import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'

export type SessionResult = {
  readonly reason: 'quit-to-title' | 'never-returned'
  readonly control: SessionControl
}

export const sessionProgram = (
  bootCtx: BootContext,
  worldId: WorldId,
  initialGameMode: GameMode,
) =>
  Effect.gen(function* () {
    const bootstrapDeps = yield* buildSessionBootstrapDeps(bootCtx, worldId, initialGameMode)
    const bootstrap = yield* buildSessionBootstrapOrchestration(bootstrapDeps)

    return yield* runSessionLifecycle(bootstrap)
  })
