import { Effect, MutableRef } from 'effect'
import {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
  type DebugFeatureFlagId,
  type DebugFeatureFlags,
  type DebugFeatureSnapshot,
} from './debug-feature-flags.config'
import type { DebugFeatureFlagGroup } from './debug-feature-flags.types'

export { DEBUG_FEATURE_FLAG_CATALOG, DEBUG_FEATURE_FLAG_DEFAULTS } from './debug-feature-flags.config'
export type {
  DebugFeatureCatalogEntry,
  DebugFeatureFlagId,
  DebugFeatureFlags,
  DebugFeatureSnapshot,
} from './debug-feature-flags.config'
export type { DebugFeatureBadge, DebugFeatureFlagGroup } from './debug-feature-flags.types'

export class DebugFeatureFlagsService extends Effect.Service<DebugFeatureFlagsService>()(
  '@minecraft/application/DebugFeatureFlagsService',
  {
    effect: Effect.sync(() => {
      const flagsRef = MutableRef.make<DebugFeatureFlags>({ ...DEBUG_FEATURE_FLAG_DEFAULTS })
      return {
        catalog: DEBUG_FEATURE_FLAG_CATALOG,
        getSnapshot: (): Effect.Effect<DebugFeatureSnapshot, never> =>
          Effect.sync(() => {
            const flags = MutableRef.get(flagsRef)
            return { catalog: DEBUG_FEATURE_FLAG_CATALOG, flags: { ...flags } }
          }),
        // Hot path: getFlags is called ~9×/frame across the frame stages. Every
        // mutator below (setEnabled/resetAll/resetGroup) replaces the flags object
        // wholesale — it is never mutated in place — so the stored value is
        // already effectively immutable and safe to expose by reference. Returning
        // the stored value directly avoids a defensive 21-field {...flags} copy.
        getFlags: (): Effect.Effect<DebugFeatureFlags, never> => Effect.sync(() => MutableRef.get(flagsRef)),
        isEnabled: (id: DebugFeatureFlagId): Effect.Effect<boolean, never> =>
          Effect.sync(() => MutableRef.get(flagsRef)[id]),
        setEnabled: (id: DebugFeatureFlagId, enabled: boolean): Effect.Effect<boolean, never> =>
          Effect.sync(() => {
            const flags = MutableRef.get(flagsRef)
            if (flags[id] === enabled) return false
            MutableRef.set(flagsRef, { ...flags, [id]: enabled })
            return true
          }),
        resetAll: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            MutableRef.set(flagsRef, { ...DEBUG_FEATURE_FLAG_DEFAULTS })
          }),
        resetGroup: (group: DebugFeatureFlagGroup): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const flags = MutableRef.get(flagsRef)
            let nextFlags = { ...flags }
            for (const entry of DEBUG_FEATURE_FLAG_CATALOG) {
              if (entry.group === group) {
                nextFlags = { ...nextFlags, [entry.id]: DEBUG_FEATURE_FLAG_DEFAULTS[entry.id] }
              }
            }
            MutableRef.set(flagsRef, nextFlags)
          }),
      }
    }),
  },
) {}
