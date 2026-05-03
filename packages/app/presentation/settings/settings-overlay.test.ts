import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect } from 'effect'
import { SettingsOverlayLive, SettingsOverlayService } from '@ts-minecraft/app/presentation/settings/settings-overlay'
import { buildTestLayer } from './settings-overlay-test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('presentation/settings/settings-overlay', () => {
  describe('SettingsOverlayLive — layer provision', () => {
    it.scoped('should provide SettingsOverlay as a Layer without error', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        expect(typeof overlay.toggle).toBe('function')
        expect(typeof overlay.isOpen).toBe('function')
        expect(typeof overlay.syncFromSettings).toBe('function')
        expect(typeof overlay.applyToSettings).toBe('function')
      }).pipe(Effect.provide(TestLayer))
    })

    it('should be defined', () => {
      expect(SettingsOverlayLive).toBeDefined()
    })
  })

  describe('isOpen', () => {
    it.scoped('should return false initially', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const open = yield* overlay.isOpen()
        expect(open).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should be consistent across multiple calls before any toggle', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const open1 = yield* overlay.isOpen()
        const open2 = yield* overlay.isOpen()
        const open3 = yield* overlay.isOpen()
        expect(open1).toBe(false)
        expect(open2).toBe(false)
        expect(open3).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
