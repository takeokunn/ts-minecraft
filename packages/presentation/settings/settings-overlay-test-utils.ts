import { Effect, Layer, Option } from 'effect'
import { vi } from 'vitest'
import { SettingsOverlayLive } from '@ts-minecraft/presentation/settings/settings-overlay'
import { SettingsService } from '@ts-minecraft/game'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

type MockElementBase = Pick<HTMLElement, 'id' | 'tagName' | 'textContent'> & {
  id: string
  tagName: string
  style: Pick<CSSStyleDeclaration, 'cssText' | 'display'>
  textContent: string | null
  dataset: Record<string, string>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

type MockControlElement = MockElementBase & {
  value: string
  checked: boolean
}

type MockTextElement = {
  textContent: string
}

const createMockControl = (tagName: string, id: string, value = '', checked = false): MockControlElement => ({
  id,
  tagName,
  style: { cssText: '', display: 'none' },
  textContent: '',
  value,
  checked,
  dataset: {},
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  remove: vi.fn(),
})

const createMockText = (textContent: string): MockTextElement => ({ textContent })

export const defaultSettings = {
  renderDistance: 4,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  graphicsQuality: 'medium' as const,
  adaptivePerformanceMode: true,
  audioEnabled: false,
  masterVolume: 0.8,
  sfxVolume: 1,
  musicVolume: 0.55,
}

export const createMockDomLayer = () => {
  const overlay = createMockControl('DIV', '')
  const gearBtn = createMockControl('BUTTON', '')
  const adaptivePerformanceInput = createMockControl('INPUT', 'adaptive-performance-input', 'on')
  const renderDistanceInput = createMockControl('INPUT', 'rd-input', '4')
  const sensitivityInput = createMockControl('INPUT', 'ms-input', '0.5')
  const dayLengthInput = createMockControl('INPUT', 'dl-input', '400')
  const qualitySelect = createMockControl('SELECT', 'quality-select', 'medium')
  const closeBtn = createMockControl('BUTTON', 'settings-close')
  const rdVal = createMockText('4')
  const msVal = createMockText('0.5')
  const dlVal = createMockText('400')

  const createElement = vi.fn(<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K] => {
    if (tagName === 'div') return overlay as HTMLElementTagNameMap[K]
    if (tagName === 'button') return gearBtn as HTMLElementTagNameMap[K]
    return createMockControl(String(tagName).toUpperCase(), '') as HTMLElementTagNameMap[K]
  })

  const querySelector = vi.fn((( _parent: HTMLElement, selector: string) => {
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
  }) as DomOperationsService['querySelector'])

  const MockDomLayer = Layer.succeed(DomOperationsService, DomOperationsService.of({
    _tag: '@minecraft/presentation/DomOperations' as const,
    createElement,
    appendChild: vi.fn(),
    appendChildTo: vi.fn(),
    removeChild: vi.fn(),
    getParentNode: vi.fn(() => Option.none()),
    setInnerHTML: vi.fn(),
    querySelector,
  }))

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

export const createMockSettingsLayer = (settings = defaultSettings) => {
  const getSettings = vi.fn(() => Effect.succeed({ ...settings }))
  const updateSettings = vi.fn((_partial: unknown) => Effect.void)
  const resetToDefaults = vi.fn(() => Effect.void)

  const MockSettingsLayer = Layer.succeed(SettingsService, SettingsService.of({
    _tag: '@minecraft/application/SettingsService' as const,
    getSettings,
    updateSettings,
    resetToDefaults,
  }))

  return { MockSettingsLayer, getSettings, updateSettings, resetToDefaults }
}

export const buildTestLayer = (
  mockDom = createMockDomLayer(),
  mockSettings = createMockSettingsLayer(),
) =>
  SettingsOverlayLive.pipe(
    Layer.provide(mockDom.MockDomLayer),
    Layer.provide(mockSettings.MockSettingsLayer),
  )
