import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect, Layer, Option } from 'effect'
import { SettingsOverlayService, SettingsOverlayLive } from '@ts-minecraft/app/presentation/settings/settings-overlay'
import { SettingsService } from '@ts-minecraft/game'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockDomLayer = () => {
  const overlay = {
    id: '',
    tagName: 'DIV',
    style: { cssText: '', display: 'none' },
    textContent: null as string | null,
    value: '',
    checked: false,
    dataset: {} as Record<string, string>,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLDivElement

  const gearBtn = {
    id: '',
    tagName: 'BUTTON',
    style: { cssText: '', display: 'none' },
    textContent: null as string | null,
    value: '',
    checked: false,
    dataset: {} as Record<string, string>,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLButtonElement

  const adaptivePerformanceInput = {
    id: 'adaptive-performance-input',
    tagName: 'INPUT',
    style: { cssText: '', display: 'none' },
    textContent: null as string | null,
    value: 'on',
    checked: false,
    dataset: {} as Record<string, string>,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLInputElement

  const renderDistanceInput = {
    id: 'rd-input',
    tagName: 'INPUT',
    style: { cssText: '', display: 'none' },
    textContent: null as string | null,
    value: '8',
    checked: false,
    dataset: {} as Record<string, string>,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLInputElement

  const sensitivityInput = {
    id: 'ms-input',
    tagName: 'INPUT',
    style: { cssText: '', display: 'none' },
    textContent: null as string | null,
    value: '0.5',
    checked: false,
    dataset: {} as Record<string, string>,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLInputElement

  const dayLengthInput = {
    id: 'dl-input',
    tagName: 'INPUT',
    style: { cssText: '', display: 'none' },
    textContent: null as string | null,
    value: '400',
    checked: false,
    dataset: {} as Record<string, string>,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLInputElement

  const qualitySelect = {
    id: 'quality-select',
    tagName: 'SELECT',
    style: { cssText: '', display: 'none' },
    textContent: null as string | null,
    value: 'high',
    checked: false,
    dataset: {} as Record<string, string>,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLSelectElement

  const closeBtn = {
    id: 'settings-close',
    tagName: 'BUTTON',
    style: { cssText: '', display: 'none' },
    textContent: null as string | null,
    value: '',
    checked: false,
    dataset: {} as Record<string, string>,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLButtonElement

  const rdVal = { textContent: '8' } as unknown as HTMLElement
  const msVal = { textContent: '0.5' } as unknown as HTMLElement
  const dlVal = { textContent: '400' } as unknown as HTMLElement

  const createElement = vi.fn((tagName: string) => {
    if (tagName === 'div') return overlay
    if (tagName === 'button') return gearBtn
    return {
      id: '',
      tagName,
      style: { cssText: '', display: 'none' },
      textContent: null as string | null,
      value: '',
      checked: false,
      dataset: {} as Record<string, string>,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLElement
  })

  const querySelector = vi.fn((_parent: unknown, selector: string) => {
    switch (selector) {
      case '#adaptive-performance-input': return Option.some(adaptivePerformanceInput)
      case '#rd-input': return Option.some(renderDistanceInput)
      case '#ms-input': return Option.some(sensitivityInput)
      case '#dl-input': return Option.some(dayLengthInput)
      case '#quality-select': return Option.some(qualitySelect)
      case '#settings-close': return Option.some(closeBtn)
      case '#settings-gear-btn': return Option.some(gearBtn)
      case '#rd-val': return Option.some(rdVal)
      case '#ms-val': return Option.some(msVal)
      case '#dl-val': return Option.some(dlVal)
      default: return Option.none()
    }
  })

  const MockDomLayer = Layer.succeed(DomOperationsService, {
    createElement,
    appendChild: vi.fn(),
    appendChildTo: vi.fn(),
    removeChild: vi.fn(),
    getParentNode: vi.fn(() => Option.none()),
    setInnerHTML: vi.fn(),
    querySelector,
  } as unknown as DomOperationsService)

  return {
    MockDomLayer,
    createElement,
    querySelector,
    elements: {
      overlay,
      adaptivePerformanceInput,
      renderDistanceInput,
      sensitivityInput,
      dayLengthInput,
      qualitySelect,
      closeBtn,
      gearBtn,
      rdVal,
      msVal,
      dlVal,
    },
  }
}

const defaultSettings = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'high',
  adaptivePerformanceMode: false,
}

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
