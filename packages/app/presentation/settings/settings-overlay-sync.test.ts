import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect } from 'effect'
import { SettingsOverlayService } from '@ts-minecraft/app/presentation/settings/settings-overlay'
import { buildTestLayer, createMockDomLayer, createMockSettingsLayer, defaultSettings } from './settings-overlay-test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('presentation/settings/settings-overlay', () => {
  describe('syncFromSettings', () => {
    it.scoped('should call getSettings on the SettingsService', () => {
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer()
      const TestLayer = buildTestLayer(mockDom, mockSettings)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.syncFromSettings()
        expect(mockSettings.getSettings).toHaveBeenCalled()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should sync adaptivePerformanceMode into the checkbox', () => {
      vi.stubGlobal('document', {})
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer({ ...defaultSettings, adaptivePerformanceMode: true })
      const TestLayer = buildTestLayer(mockDom, mockSettings)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.syncFromSettings()
        expect(mockDom.elements.adaptivePerformanceInput.checked).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should complete without error', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.syncFromSettings()
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('applyToSettings', () => {
    it.scoped('should call updateSettings on the SettingsService', () => {
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer()
      const TestLayer = buildTestLayer(mockDom, mockSettings)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.applyToSettings()
        expect(mockSettings.updateSettings).toHaveBeenCalled()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should include adaptivePerformanceMode in the update payload', () => {
      vi.stubGlobal('document', {})
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer({ ...defaultSettings, adaptivePerformanceMode: true })
      const TestLayer = buildTestLayer(mockDom, mockSettings)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.applyToSettings()
        expect(mockSettings.updateSettings).toHaveBeenCalledWith({
          adaptivePerformanceMode: true,
          renderDistance: 8,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
          graphicsQuality: 'high',
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should complete without error', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.applyToSettings()
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('Effect composition', () => {
    it.scoped('should support toggle.flatMap(isOpen)', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const isOpen = yield* overlay.toggle().pipe(
          Effect.flatMap(() => overlay.isOpen())
        )
        expect(isOpen).toBe(true)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should support chaining multiple operations', () => {
      const TestLayer = buildTestLayer()
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        yield* overlay.syncFromSettings()
        const isOpen = yield* overlay.isOpen()
        yield* overlay.toggle()
        const isClosed = yield* overlay.isOpen()
        expect(isOpen).toBe(true)
        expect(isClosed).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
