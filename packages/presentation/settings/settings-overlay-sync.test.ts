import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect } from 'effect'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings/settings-overlay'
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

    it.scoped('should sync audio settings into audio controls', () => {
      vi.stubGlobal('document', {})
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer({
        ...defaultSettings,
        audioEnabled: true,
        masterVolume: 0.35,
        sfxVolume: 0.75,
        musicVolume: 0.2,
      })
      const TestLayer = buildTestLayer(mockDom, mockSettings)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.syncFromSettings()
        expect(mockDom.elements.audioEnabledInput.checked).toBe(true)
        expect(mockDom.elements.masterVolumeInput.value).toBe('0.35')
        expect(mockDom.elements.sfxVolumeInput.value).toBe('0.75')
        expect(mockDom.elements.musicVolumeInput.value).toBe('0.2')
        expect(mockDom.elements.mvVal.textContent).toBe('35%')
        expect(mockDom.elements.svVal.textContent).toBe('75%')
        expect(mockDom.elements.muvVal.textContent).toBe('20%')
        expect(mockDom.elements.masterVolumeInput.getAttribute('aria-valuetext')).toBe('35%')
        expect(mockDom.elements.sfxVolumeInput.getAttribute('aria-valuetext')).toBe('75%')
        expect(mockDom.elements.musicVolumeInput.getAttribute('aria-valuetext')).toBe('20%')
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should update volume labels as percentages while dragging sliders', () => {
      vi.stubGlobal('document', {})
      const mockDom = createMockDomLayer()
      const TestLayer = buildTestLayer(mockDom)
      return Effect.gen(function* () {
        yield* SettingsOverlayService
        const masterHandler = mockDom.elements.masterVolumeInput.addEventListener.mock.calls.find(([eventName]) => eventName === 'input')?.[1]
        const sfxHandler = mockDom.elements.sfxVolumeInput.addEventListener.mock.calls.find(([eventName]) => eventName === 'input')?.[1]
        const musicHandler = mockDom.elements.musicVolumeInput.addEventListener.mock.calls.find(([eventName]) => eventName === 'input')?.[1]
        expect(masterHandler).toEqual(expect.any(Function))
        expect(sfxHandler).toEqual(expect.any(Function))
        expect(musicHandler).toEqual(expect.any(Function))
        const runInputHandler = (handler: unknown) => (handler as () => void)()

        mockDom.elements.masterVolumeInput.value = '0.45'
        runInputHandler(masterHandler)
        mockDom.elements.sfxVolumeInput.value = '0.05'
        runInputHandler(sfxHandler)
        mockDom.elements.musicVolumeInput.value = '1'
        runInputHandler(musicHandler)

        expect(mockDom.elements.mvVal.textContent).toBe('45%')
        expect(mockDom.elements.svVal.textContent).toBe('5%')
        expect(mockDom.elements.muvVal.textContent).toBe('100%')
        expect(mockDom.elements.masterVolumeInput.getAttribute('aria-valuetext')).toBe('45%')
        expect(mockDom.elements.sfxVolumeInput.getAttribute('aria-valuetext')).toBe('5%')
        expect(mockDom.elements.musicVolumeInput.getAttribute('aria-valuetext')).toBe('100%')
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
          renderDistance: 4,
          mouseSensitivity: 0.5,
          fov: 75,
          dayLengthSeconds: 400,
          audioEnabled: false,
          masterVolume: 0.8,
          sfxVolume: 1,
          musicVolume: 0.55,
          graphicsQuality: 'medium',
          difficulty: 'normal',
          reducedMotion: false,
          uiScale: 1,
          keyBindings: {},
        })
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should include audio fields in the update payload', () => {
      vi.stubGlobal('document', {})
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer({
        ...defaultSettings,
        audioEnabled: true,
        masterVolume: 0.4,
        sfxVolume: 0.65,
        musicVolume: 0.15,
      })
      const TestLayer = buildTestLayer(mockDom, mockSettings)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.applyToSettings()
        expect(mockSettings.updateSettings).toHaveBeenCalledWith({
          adaptivePerformanceMode: true,
          renderDistance: 4,
          mouseSensitivity: 0.5,
          fov: 75,
          dayLengthSeconds: 400,
          audioEnabled: true,
          masterVolume: 0.4,
          sfxVolume: 0.65,
          musicVolume: 0.15,
          graphicsQuality: 'medium',
          difficulty: 'normal',
          reducedMotion: false,
          uiScale: 1,
          keyBindings: {},
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
