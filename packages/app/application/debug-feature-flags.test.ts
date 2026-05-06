import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'

import {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
  DebugFeatureFlagsService,
  DebugFeatureFlagsServiceLive,
} from '@ts-minecraft/app/debug-feature-flags'

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
    }).pipe(Effect.provide(DebugFeatureFlagsServiceLive)),
  )
})
