import { Effect } from 'effect'

import type { SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime-types'
import type { SessionRuntimeBundleInput } from '@ts-minecraft/app/main/session-bootstrap-runtime-deps'
import { buildSessionRuntimeServices } from '@ts-minecraft/app/main/session-bootstrap-runtime-services'
import { createSessionRuntimeBootstrapState } from '@ts-minecraft/app/main/session-bootstrap-runtime-state'
import { buildSessionRuntimeParams } from '@ts-minecraft/app/main/session-bootstrap-runtime-params'

export type SessionRuntimeBundle = {
  readonly runtimeParams: SessionRuntimeParams
  readonly runtimeServices: ReturnType<typeof buildSessionRuntimeServices>
}

export const buildSessionRuntimeBundle = ({
  bootCtx,
  rendering,
  state,
  overlays,
  services,
}: SessionRuntimeBundleInput) =>
  Effect.gen(function* () {
    const runtimeState = yield* createSessionRuntimeBootstrapState
    const runtimeParams = buildSessionRuntimeParams({
      bootCtx: { renderer: bootCtx.renderer },
      rendering,
      state,
      overlays,
      runtimeState,
    })
    const runtimeServices = buildSessionRuntimeServices({ bootCtx, services })

    return { runtimeParams, runtimeServices }
  })
