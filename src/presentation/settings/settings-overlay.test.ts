import { describe, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { expect, vi } from 'vitest'
import { SettingsOverlay, SettingsOverlayLive } from './settings-overlay'
import { SettingsService } from '@/application/settings/settings-service'
import { DomOperations } from '@/presentation/hud/crosshair'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockSettingsService = (
  initial = { renderDistance: 8, mouseSensitivity: 0.5, dayLengthSeconds: 400 }
) => {
  let current = { ...initial }
  return {
    getSettings: vi.fn(() => Effect.succeed(current)),
    updateSettings: vi.fn((partial: Partial<typeof current>) => {
      current = { ...current, ...partial }
      return Effect.void
    }),
    resetToDefaults: vi.fn(() => Effect.void),
  } as unknown as SettingsService
}

const createMockDomOperations = () => {
  const elements: Array<{
    id: string
    style: { cssText: string; display: string }
    dataset: Record<string, string>
    textContent: string
    innerHTML: string
    children: unknown[]
    parentNode: unknown | null
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
    querySelector: ReturnType<typeof vi.fn>
    value: string
  }> = []

  const makeEl = () => {
    const el = {
      id: '',
      style: { cssText: '', display: '' },
      dataset: {} as Record<string, string>,
      textContent: '',
      innerHTML: '',
      children: [] as unknown[],
      parentNode: null as unknown | null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(() => { el.parentNode = null }),
      querySelector: vi.fn((_selector: string) => null),
      value: '',
    }
    elements.push(el)
    return el
  }

  const dom = {
    createElement: vi.fn((_tag: string) => makeEl()),
    appendChild: vi.fn((el: unknown) => {
      ;(el as { parentNode: unknown }).parentNode = 'body'
    }),
    appendChildTo: vi.fn(),
    removeChild: vi.fn((el: unknown) => {
      ;(el as { parentNode: unknown | null }).parentNode = null
    }),
    getParentNode: vi.fn((el: unknown) => (el as { parentNode: unknown }).parentNode),
    setInnerHTML: vi.fn((el: { innerHTML: string }, html: string) => {
      el.innerHTML = html
    }),
    querySelector: vi.fn((_el: unknown, _selector: string) => null),
  } as unknown as DomOperations

  return { dom, elements }
}

const buildTestLayer = (
  settingsService: SettingsService = createMockSettingsService(),
  dom: DomOperations = createMockDomOperations().dom
) => {
  const MockSettingsLayer = Layer.succeed(SettingsService, settingsService)
  const MockDomLayer = Layer.succeed(DomOperations, dom)
  return SettingsOverlayLive.pipe(
    Layer.provide(Layer.merge(MockSettingsLayer, MockDomLayer))
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsOverlay', () => {
  describe('isOpen', () => {
    it('should return false initially', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        const result = yield* overlay.isOpen()
        expect(result).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should return false before any toggle', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        const result = yield* overlay.isOpen()
        expect(result).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })
  })

  describe('toggle', () => {
    it('should return true after first toggle (open)', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        const result = yield* overlay.toggle()
        expect(result).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should make isOpen return true after toggle', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        yield* overlay.toggle()
        const result = yield* overlay.isOpen()
        expect(result).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should return false after second toggle (close)', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        yield* overlay.toggle()
        const result = yield* overlay.toggle()
        expect(result).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should make isOpen return false after two toggles', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        yield* overlay.toggle()
        yield* overlay.toggle()
        const result = yield* overlay.isOpen()
        expect(result).toBe(false)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should alternate visibility through multiple toggles', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        const states: boolean[] = []

        states.push(yield* overlay.isOpen())    // false initially

        yield* overlay.toggle()
        states.push(yield* overlay.isOpen())    // true

        yield* overlay.toggle()
        states.push(yield* overlay.isOpen())    // false

        yield* overlay.toggle()
        states.push(yield* overlay.isOpen())    // true

        expect(states).toEqual([false, true, false, true])
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })
  })

  describe('initialize', () => {
    it('should complete without error', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        yield* overlay.initialize()
      })

      expect(() =>
        Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
      ).not.toThrow()
    })
  })

  describe('syncFromSettings', () => {
    it('should call getSettings on the settings service', () => {
      const mockSettings = createMockSettingsService()
      const TestLayer = buildTestLayer(mockSettings)

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        yield* overlay.syncFromSettings()
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))

      expect(mockSettings.getSettings).toHaveBeenCalled()
    })

    it('should not throw when called before any input elements are available', () => {
      const mockSettings = createMockSettingsService()
      const TestLayer = buildTestLayer(mockSettings)

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        yield* overlay.syncFromSettings()
      })

      expect(() =>
        Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
      ).not.toThrow()
    })
  })

  describe('applyToSettings', () => {
    it('should call updateSettings on the settings service', () => {
      const mockSettings = createMockSettingsService()
      const TestLayer = buildTestLayer(mockSettings)

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        yield* overlay.applyToSettings()
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))

      expect(mockSettings.updateSettings).toHaveBeenCalledWith({
        renderDistance: 8,
        mouseSensitivity: expect.any(Number),
        dayLengthSeconds: expect.any(Number),
      })
    })

    it('should complete without throwing', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        yield* overlay.applyToSettings()
      })

      expect(() =>
        Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
      ).not.toThrow()
    })
  })

  describe('integration', () => {
    it('should handle open → close → open cycle', () => {
      const TestLayer = buildTestLayer()

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay

        // Open
        const r1 = yield* overlay.toggle()
        expect(r1).toBe(true)
        expect(yield* overlay.isOpen()).toBe(true)

        // Close
        const r2 = yield* overlay.toggle()
        expect(r2).toBe(false)
        expect(yield* overlay.isOpen()).toBe(false)

        // Open again
        const r3 = yield* overlay.toggle()
        expect(r3).toBe(true)
        expect(yield* overlay.isOpen()).toBe(true)
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })

    it('should sync settings from service when toggled open', () => {
      const mockSettings = createMockSettingsService({
        renderDistance: 12,
        mouseSensitivity: 1.5,
        dayLengthSeconds: 600,
      })
      const TestLayer = buildTestLayer(mockSettings)

      const program = Effect.gen(function* () {
        const overlay = yield* SettingsOverlay
        // Toggling open triggers syncEffect which calls getSettings
        yield* overlay.toggle()
        expect(mockSettings.getSettings).toHaveBeenCalled()
      })

      Effect.runSync(program.pipe(Effect.provide(TestLayer), Effect.scoped))
    })
  })
})
