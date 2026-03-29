import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { SettingsOverlayService, SettingsOverlayLive } from './settings-overlay'
import { SettingsService } from '@/application/settings/settings-service'
import { DomOperationsService } from '@/presentation/hud/crosshair'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockDomLayer = () => {
  const createElement = vi.fn((tagName: string) => {
    const el = {
      id: '',
      tagName,
      style: { cssText: '', display: 'none' },
      textContent: null as string | null,
      value: '8',
      dataset: {} as Record<string, string>,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLElement
    return el
  })

  const MockDomLayer = Layer.succeed(DomOperationsService, {
    createElement,
    appendChild: vi.fn(),
    appendChildTo: vi.fn(),
    removeChild: vi.fn(),
    getParentNode: vi.fn(() => Option.none()),
    setInnerHTML: vi.fn(),
    querySelector: vi.fn(() => Option.none()),
  } as unknown as DomOperationsService)

  return { MockDomLayer, createElement }
}

const defaultSettings = { renderDistance: 8, mouseSensitivity: 0.5, dayLengthSeconds: 400 }

const createMockSettingsLayer = (settings = defaultSettings) => {
  const getSettings = vi.fn(() => Effect.succeed({ ...settings }))
  const updateSettings = vi.fn((_partial: unknown) => Effect.void)
  const resetToDefaults = vi.fn(() => Effect.void)

  const MockSettingsLayer = Layer.succeed(SettingsService, {
    getSettings,
    updateSettings,
    resetToDefaults,
  } as unknown as SettingsService)

  return { MockSettingsLayer, getSettings, updateSettings, resetToDefaults }
}

const buildTestLayer = (
  mockDom = createMockDomLayer(),
  mockSettings = createMockSettingsLayer()
) =>
  SettingsOverlayLive.pipe(
    Layer.provide(mockDom.MockDomLayer),
    Layer.provide(mockSettings.MockSettingsLayer)
  )

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
