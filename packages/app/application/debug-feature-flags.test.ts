import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'

import {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
} from '@ts-minecraft/app/application/debug-feature-flags.config'
import { DebugFeatureFlagsService } from '@ts-minecraft/app/application/debug-feature-flags'

describe('application/debug-feature-flags', () => {
  it.effect('keeps flags session-local and supports mutation/reset helpers', () =>
    Effect.gen(function* () {
      const debugFeatureFlags = yield* DebugFeatureFlagsService

      const initial = yield* debugFeatureFlags.getSnapshot()
      const changed = yield* debugFeatureFlags.setEnabled('mobs.spawn', false)
      const afterDisable = yield* debugFeatureFlags.getFlags()
      yield* debugFeatureFlags.resetGroup('mobs')
      const afterGroupReset = yield* debugFeatureFlags.getFlags()
      yield* debugFeatureFlags.setEnabled('rendering.sky', false)
      yield* debugFeatureFlags.resetAll()
      const afterResetAll = yield* debugFeatureFlags.getFlags()

      expect(initial.catalog).toEqual(DEBUG_FEATURE_FLAG_CATALOG)
      expect(initial.flags).toEqual(DEBUG_FEATURE_FLAG_DEFAULTS)
      expect(changed).toBe(true)
      expect(afterDisable['mobs.spawn']).toBe(false)
      expect(afterGroupReset['mobs.spawn']).toBe(true)
      expect(afterResetAll).toEqual(DEBUG_FEATURE_FLAG_DEFAULTS)
    }).pipe(Effect.provide(DebugFeatureFlagsService.Default)),
  )

  it.effect('isEnabled returns the current flag value', () =>
    Effect.gen(function* () {
      const svc = yield* DebugFeatureFlagsService
      const enabled = yield* svc.isEnabled('mobs.enabled')
      expect(enabled).toBe(DEBUG_FEATURE_FLAG_DEFAULTS['mobs.enabled'])
    }).pipe(Effect.provide(DebugFeatureFlagsService.Default)),
  )

  it.effect('setEnabled returns false (no-op) when the value is already set to the same state', () =>
    Effect.gen(function* () {
      const svc = yield* DebugFeatureFlagsService
      // mobs.enabled defaults to true → setting it to true again returns false
      const changed = yield* svc.setEnabled('mobs.enabled', true)
      expect(changed).toBe(false)
    }).pipe(Effect.provide(DebugFeatureFlagsService.Default)),
  )
})
