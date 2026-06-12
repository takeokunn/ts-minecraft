import { Effect, Ref } from 'effect'
import type { DebugFeatureFlagGroup } from './debug-feature-flags.types'
import {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
  type DebugFeatureFlagId,
  type DebugFeatureFlags,
  type DebugFeatureSnapshot,
} from './debug-feature-flags.config'

export type { DebugFeatureFlagGroup } from './debug-feature-flags.types'
export type { DebugFeatureBadge, DebugFeatureCatalogShape } from './debug-feature-flags.types'
export {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
} from './debug-feature-flags.config'
export type {
  DebugFeatureCatalogEntry,
  DebugFeatureFlagId,
  DebugFeatureFlags,
  DebugFeatureSnapshot,
} from './debug-feature-flags.config'

export class DebugFeatureFlagsService extends Effect.Service<DebugFeatureFlagsService>()(
  '@minecraft/application/DebugFeatureFlagsService',
  {
    effect: Effect.gen(function* () {
      const flagsRef = yield* Ref.make<DebugFeatureFlags>({ ...DEBUG_FEATURE_FLAG_DEFAULTS })
      return {
        catalog: DEBUG_FEATURE_FLAG_CATALOG,
        getSnapshot: (): Effect.Effect<DebugFeatureSnapshot, never> =>
          Effect.gen(function* () {
            const flags = yield* Ref.get(flagsRef)
            return { catalog: DEBUG_FEATURE_FLAG_CATALOG, flags: { ...flags } }
          }),
        getFlags: (): Effect.Effect<DebugFeatureFlags, never> =>
          Effect.gen(function* () {
            const flags = yield* Ref.get(flagsRef)
            return { ...flags }
          }),
        isEnabled: (id: DebugFeatureFlagId): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const flags = yield* Ref.get(flagsRef)
            return flags[id]
          }),
        setEnabled: (id: DebugFeatureFlagId, enabled: boolean): Effect.Effect<boolean, never> =>
          Ref.modify(flagsRef, (flags): [boolean, DebugFeatureFlags] =>
            flags[id] === enabled
              ? [false, flags]
              : [true, { ...flags, [id]: enabled }],
          ),
        resetAll: (): Effect.Effect<void, never> =>
          Ref.set(flagsRef, { ...DEBUG_FEATURE_FLAG_DEFAULTS }),
        resetGroup: (group: DebugFeatureFlagGroup): Effect.Effect<void, never> =>
          Ref.update(flagsRef, (flags) => {
            let nextFlags = { ...flags }
            for (const entry of DEBUG_FEATURE_FLAG_CATALOG) {
              if (entry.group === group) {
                nextFlags = { ...nextFlags, [entry.id]: DEBUG_FEATURE_FLAG_DEFAULTS[entry.id] }
              }
            }
            return nextFlags
          }),
      }
    }),
  },
) {}

export const DebugFeatureFlagsServiceLive = DebugFeatureFlagsService.Default
