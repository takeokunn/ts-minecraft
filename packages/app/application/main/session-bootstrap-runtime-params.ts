import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionRuntimeBootstrapState } from '@ts-minecraft/app/main/session-bootstrap-runtime-state'
import type {
  SessionHudElements,
  SessionRenderingResources,
  SessionRuntimeOverlays,
  SessionRuntimeParams,
  SessionRuntimeState,
} from '@ts-minecraft/app/main/session-runtime-types'

export type SessionRuntimeParamsInput = {
  readonly bootCtx: Pick<BootContext, 'renderer'>
  readonly rendering: Omit<SessionRenderingResources, 'renderer'>
  readonly state: Pick<SessionRuntimeState, 'control' | 'respawnPositionRef' | 'persistSessionState'>
  readonly overlays: SessionRuntimeOverlays
  readonly runtimeState: SessionRuntimeBootstrapState
}

export const buildSessionRuntimeParams = ({
  bootCtx,
  rendering,
  state,
  overlays,
  runtimeState,
}: SessionRuntimeParamsInput): SessionRuntimeParams => {
  const { pendingResizeRef, pendingSaveDirtyChunksRef, gamePausedRef, hudElements } = runtimeState
  const { fpsElement, healthValueElement, healthMaxElement, hungerValueElement, hungerMaxElement, xpLevelElement, xpBarElement, xpBarMaxElement, armorValueElement, airElement, breakProgressElement } = hudElements

  const renderingResources: SessionRenderingResources = {
    renderer: bootCtx.renderer,
    ...rendering,
  }
  const hud: SessionHudElements = {
    fpsElement,
    healthValueElement,
    healthMaxElement,
    hungerValueElement,
    hungerMaxElement,
    xpLevelElement,
    xpBarElement,
    xpBarMaxElement,
    armorValueElement,
    airElement,
    breakProgressElement,
  }
  const runtimeStateValue: SessionRuntimeState = {
    ...state,
    gamePausedRef,
    pendingResizeRef,
    pendingSaveDirtyChunksRef,
  }

  return {
    rendering: renderingResources,
    hud,
    state: runtimeStateValue,
    overlays,
  }
}
