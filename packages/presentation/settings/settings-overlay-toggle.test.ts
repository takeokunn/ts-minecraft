import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect } from 'effect'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings/settings-overlay'
import { buildTestLayer, createMockDomLayer, createMockSettingsLayer } from './settings-overlay-test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('presentation/settings/settings-overlay', () => {
  describe('toggle', () => {
    it.scoped('should return true on first call (opens)', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const result = yield* overlay.toggle()
        expect(result).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should return false on second call (closes)', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        const result = yield* overlay.toggle()
        expect(result).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should return true on third call (opens again)', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        yield* overlay.toggle()
        const result = yield* overlay.toggle()
        expect(result).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should update isOpen after toggle', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const openBefore = yield* overlay.isOpen()
        yield* overlay.toggle()
        const openAfter = yield* overlay.isOpen()
        expect(openBefore).toBe(false)
        expect(openAfter).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should sync from settings when toggling open', () => {
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer()
      const TestLayer = buildTestLayer(mockDom, mockSettings)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        expect(mockSettings.getSettings).toHaveBeenCalled()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should NOT sync from settings when toggling closed', () => {
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer()
      const TestLayer = buildTestLayer(mockDom, mockSettings)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle() // open (syncs)
        const callsAfterOpen = mockSettings.getSettings.mock.calls.length
        yield* overlay.toggle() // close (should NOT sync)
        expect(mockSettings.getSettings.mock.calls.length).toBe(callsAfterOpen)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
