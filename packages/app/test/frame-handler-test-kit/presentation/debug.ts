import { Effect } from 'effect'
import { DEBUG_FEATURE_FLAG_CATALOG, DEBUG_FEATURE_FLAG_DEFAULTS, type DebugFeatureFlagGroup, type DebugFeatureFlagId } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { DebugFeatureFlagsService } from '@ts-minecraft/app/application/debug-feature-flags'

/** Creates a debug feature flag service fake backed by mutable in-memory flags. */
export const makeDebugFeatureFlags = () => {
  const debugFlagsState = { current: { ...DEBUG_FEATURE_FLAG_DEFAULTS } }
  const resetDebugFeatureGroup = (group: DebugFeatureFlagGroup): Effect.Effect<void, never> =>
    Effect.sync(() => {
      const overrides = Object.fromEntries(
        DEBUG_FEATURE_FLAG_CATALOG
          .filter((entry) => entry.group === group)
          .map((entry) => [entry.id, DEBUG_FEATURE_FLAG_DEFAULTS[entry.id]] as const),
      )
      debugFlagsState.current = { ...debugFlagsState.current, ...overrides }
    })

  return DebugFeatureFlagsService.of({
    _tag: '@minecraft/application/DebugFeatureFlagsService' as const,
    catalog: DEBUG_FEATURE_FLAG_CATALOG,
    getSnapshot: () =>
      Effect.succeed({
        catalog: DEBUG_FEATURE_FLAG_CATALOG,
        flags: { ...debugFlagsState.current },
      }),
    getFlags: () => Effect.succeed({ ...debugFlagsState.current }),
    isEnabled: (id: DebugFeatureFlagId) => Effect.succeed(debugFlagsState.current[id]),
    setEnabled: (id: DebugFeatureFlagId, enabled: boolean) =>
      Effect.sync(() => {
        const changed = debugFlagsState.current[id] !== enabled
        debugFlagsState.current = { ...debugFlagsState.current, [id]: enabled }
        return changed
      }),
    resetAll: () =>
      Effect.sync(() => {
        debugFlagsState.current = { ...DEBUG_FEATURE_FLAG_DEFAULTS }
      }),
    resetGroup: resetDebugFeatureGroup,
  })
}
