import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'

import { DEBUG_FEATURE_FLAG_CATALOG } from '@ts-minecraft/app/application/debug-feature-flags'
import {
  DebugOverlayService,
  debugFeatureGroupLabels,
  debugFeatureSearchMatches,
  facingFromYaw,
} from '@ts-minecraft/presentation/hud/debug-overlay'

describe('presentation/hud/debug-overlay', () => {
  describe('facingFromYaw', () => {
    it('returns south for yaw≈0', () => {
      const f = facingFromYaw(0)
      expect(f.name).toBe('south')
      expect(f.axis).toBe('Towards positive Z')
    })

    it('returns west for yaw≈π/2', () => {
      const f = facingFromYaw(Math.PI / 2)
      expect(f.name).toBe('west')
      expect(f.axis).toBe('Towards negative X')
    })

    it('returns north for yaw≈π', () => {
      const f = facingFromYaw(Math.PI)
      expect(f.name).toBe('north')
      expect(f.axis).toBe('Towards negative Z')
    })

    it('returns east for yaw≈-π/2', () => {
      const f = facingFromYaw(-Math.PI / 2)
      expect(f.name).toBe('east')
      expect(f.axis).toBe('Towards positive X')
    })

    it('normalises yaw outside (-π, π]', () => {
      // 5π/2 == π/2 (mod 2π)
      const f = facingFromYaw(5 * Math.PI / 2)
      expect(f.name).toBe('west')
    })
  })

  describe('debug toggle panel helpers', () => {
    it('exposes readable labels for each debug feature group', () => {
      expect(debugFeatureGroupLabels.rendering).toBe('Rendering')
      expect(debugFeatureGroupLabels.mobs).toBe('Mobs')
      expect(debugFeatureGroupLabels.world).toBe('World / Chunks')
    })

    it('matches search text against id, label, group, description, and badges', () => {
      const mobMaster = DEBUG_FEATURE_FLAG_CATALOG.find((entry) => entry.id === 'mobs.enabled')
      const postProcessing = DEBUG_FEATURE_FLAG_CATALOG.find((entry) => entry.id === 'rendering.postProcessing')

      expect(mobMaster).toBeDefined()
      expect(postProcessing).toBeDefined()
      if (mobMaster === undefined || postProcessing === undefined) return

      expect(debugFeatureSearchMatches(mobMaster, 'mobs')).toBe(true)
      expect(debugFeatureSearchMatches(mobMaster, 'danger')).toBe(true)
      expect(debugFeatureSearchMatches(postProcessing, 'fullscreen')).toBe(true)
      expect(debugFeatureSearchMatches(postProcessing, 'not-present')).toBe(false)
    })
  })

  describe('DebugOverlayService — SSR-safe path', () => {
    it.scoped('initial visibility is false', () =>
      Effect.gen(function* () {
        const overlay = yield* DebugOverlayService
        const visible = yield* overlay.isVisible()
        expect(visible).toBe(false)
      }).pipe(Effect.provide(DebugOverlayService.Default)),
    )

    it.scoped('toggle flips visibility once', () =>
      Effect.gen(function* () {
        const overlay = yield* DebugOverlayService
        yield* overlay.toggle()
        const visible = yield* overlay.isVisible()
        expect(visible).toBe(true)
        yield* overlay.toggle()
        const visible2 = yield* overlay.isVisible()
        expect(visible2).toBe(false)
      }).pipe(Effect.provide(DebugOverlayService.Default)),
    )

    it.scoped('show / hide drive visibility flag', () =>
      Effect.gen(function* () {
        const overlay = yield* DebugOverlayService
        yield* overlay.show()
        expect(yield* overlay.isVisible()).toBe(true)
        yield* overlay.hide()
        expect(yield* overlay.isVisible()).toBe(false)
      }).pipe(Effect.provide(DebugOverlayService.Default)),
    )

    it('Live layer is defined', () => {
      expect(DebugOverlayService.Default).toBeDefined()
    })
  })
})
