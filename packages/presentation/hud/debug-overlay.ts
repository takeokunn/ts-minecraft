import { Effect } from 'effect'
import { createDebugOverlayRuntime } from '@ts-minecraft/presentation/hud/debug-overlay-runtime'
export {
  applyDebugOverlayPanelState,
  resolveDebugOverlayPanelState,
  type DebugOverlayGroupSectionState,
  type DebugOverlayPanelState,
  type DebugOverlayToggleRowState,
} from '@ts-minecraft/presentation/hud/debug-overlay-panel-state'

export type { DebugOverlayDeps, DebugOverlayInterface } from '@ts-minecraft/presentation/hud/debug-overlay-types'
export { debugFeatureGroupLabels, debugFeatureSearchMatches, facingFromYaw } from '@ts-minecraft/presentation/hud/debug-overlay-utils'

export class DebugOverlayService extends Effect.Service<DebugOverlayService>()(
  '@minecraft/presentation/DebugOverlayService',
  {
    scoped: Effect.sync(() => createDebugOverlayRuntime()),
  },
) {}
