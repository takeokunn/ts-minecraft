import { describe, it, expect, vi } from 'vitest'
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

const runScoped = <A>(effect: Effect.Effect<A, never, never>) =>
  Effect.runSync(effect.pipe(Effect.scoped))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('presentation/settings/settings-overlay', () => {
  describe('SettingsOverlayLive — layer provision', () => {
    it('should provide SettingsOverlay as a Layer without error', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        expect(typeof overlay.toggle).toBe('function')
        expect(typeof overlay.isOpen).toBe('function')
        expect(typeof overlay.syncFromSettings).toBe('function')
        expect(typeof overlay.applyToSettings).toBe('function')
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.success).toBe(true)
    })

    it('should be defined', () => {
      expect(SettingsOverlayLive).toBeDefined()
    })
  })

  describe('isOpen', () => {
    it('should return false initially', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const open = yield* overlay.isOpen()
        return { open }
      }).pipe(Effect.provide(TestLayer))

      const { open } = runScoped(program)
      expect(open).toBe(false)
    })

    it('should be consistent across multiple calls before any toggle', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const open1 = yield* overlay.isOpen()
        const open2 = yield* overlay.isOpen()
        const open3 = yield* overlay.isOpen()
        return { open1, open2, open3 }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.open1).toBe(false)
      expect(result.open2).toBe(false)
      expect(result.open3).toBe(false)
    })
  })

  describe('toggle', () => {
    it('should return true on first call (opens)', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const result = yield* overlay.toggle()
        return { result }
      }).pipe(Effect.provide(TestLayer))

      const { result } = runScoped(program)
      expect(result).toBe(true)
    })

    it('should return false on second call (closes)', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        const result = yield* overlay.toggle()
        return { result }
      }).pipe(Effect.provide(TestLayer))

      const { result } = runScoped(program)
      expect(result).toBe(false)
    })

    it('should return true on third call (opens again)', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        yield* overlay.toggle()
        const result = yield* overlay.toggle()
        return { result }
      }).pipe(Effect.provide(TestLayer))

      const { result } = runScoped(program)
      expect(result).toBe(true)
    })

    it('should update isOpen after toggle', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const openBefore = yield* overlay.isOpen()
        yield* overlay.toggle()
        const openAfter = yield* overlay.isOpen()
        return { openBefore, openAfter }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.openBefore).toBe(false)
      expect(result.openAfter).toBe(true)
    })

    it('should sync from settings when toggling open', () => {
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer()
      const TestLayer = buildTestLayer(mockDom, mockSettings)

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      runScoped(program)
      // getSettings should have been called to sync
      expect(mockSettings.getSettings).toHaveBeenCalled()
    })

    it('should NOT sync from settings when toggling closed', () => {
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer()
      const TestLayer = buildTestLayer(mockDom, mockSettings)

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle() // open (syncs)
        const callsAfterOpen = mockSettings.getSettings.mock.calls.length
        yield* overlay.toggle() // close (should NOT sync)
        return { callsAfterOpen }
      }).pipe(Effect.provide(TestLayer))

      const { callsAfterOpen } = runScoped(program)
      // Second toggle (close) should not call getSettings again
      expect(mockSettings.getSettings.mock.calls.length).toBe(callsAfterOpen)
    })
  })

  describe('syncFromSettings', () => {
    it('should call getSettings on the SettingsService', () => {
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer()
      const TestLayer = buildTestLayer(mockDom, mockSettings)

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.syncFromSettings()
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      runScoped(program)
      expect(mockSettings.getSettings).toHaveBeenCalled()
    })

    it('should complete without error', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.syncFromSettings()
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.success).toBe(true)
    })
  })

  describe('applyToSettings', () => {
    it('should call updateSettings on the SettingsService', () => {
      const mockDom = createMockDomLayer()
      const mockSettings = createMockSettingsLayer()
      const TestLayer = buildTestLayer(mockDom, mockSettings)

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.applyToSettings()
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      runScoped(program)
      expect(mockSettings.updateSettings).toHaveBeenCalled()
    })

    it('should complete without error', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.applyToSettings()
        return { success: true }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.success).toBe(true)
    })
  })

  describe('Effect composition', () => {
    it('should support toggle.flatMap(isOpen)', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const isOpen = yield* overlay.toggle().pipe(
          Effect.flatMap(() => overlay.isOpen())
        )
        return { isOpen }
      }).pipe(Effect.provide(TestLayer))

      const { isOpen } = runScoped(program)
      expect(isOpen).toBe(true)
    })

    it('should support chaining multiple operations', () => {
      const TestLayer = buildTestLayer()
      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        yield* overlay.syncFromSettings()
        const isOpen = yield* overlay.isOpen()
        yield* overlay.toggle()
        const isClosed = yield* overlay.isOpen()
        return { isOpen, isClosed }
      }).pipe(Effect.provide(TestLayer))

      const result = runScoped(program)
      expect(result.isOpen).toBe(true)
      expect(result.isClosed).toBe(false)
    })
  })
})
