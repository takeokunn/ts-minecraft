import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionBootstrapServices } from '@ts-minecraft/app/main/session-bootstrap-types/services'
import type {
  SessionRenderingResources,
  SessionRuntimeOverlays,
  SessionRuntimeState,
} from '@ts-minecraft/app/main/session-runtime-types'

export type SessionRuntimeBundleBootCtxInput = Pick<
  BootContext,
  'perfHud' | 'renderer' | 'settingsService' | 'soundManager' | 'musicManager'
>

export type SessionRuntimeBundleRenderingInput = Pick<
  SessionRenderingResources,
  'scene' | 'camera' | 'composerRT' | 'composer' | 'gtaoPass' | 'bloomPass' | 'bokehPass' | 'godRaysPass' | 'smaaPass' | 'lighting'
>

export type SessionRuntimeBundleStateInput = Pick<
  SessionRuntimeState,
  'control' | 'respawnPositionRef' | 'persistSessionState'
>

export type SessionRuntimeBundleInput = {
  readonly bootCtx: SessionRuntimeBundleBootCtxInput
  readonly rendering: SessionRuntimeBundleRenderingInput
  readonly state: SessionRuntimeBundleStateInput
  readonly overlays: SessionRuntimeOverlays
  readonly services: SessionBootstrapServices
}
