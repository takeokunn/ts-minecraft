import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect } from 'effect'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings/settings-overlay'
import { buildTestLayer, createMockDomLayer } from './settings-overlay-test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('presentation/settings/settings-overlay', () => {
  describe('SettingsOverlayService — layer provision', () => {
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
      expect(SettingsOverlayService.Default).toBeDefined()
    })

    it.scoped('should render audio sliders with accessible percentage labels', () => {
      vi.stubGlobal('document', {})
      const mockDom = createMockDomLayer()
      const TestLayer = buildTestLayer(mockDom)
      return Effect.gen(function* () {
        yield* SettingsOverlayService
        const html = mockDom.setInnerHTML.mock.calls[0]?.[1]
        expect(html).toContain('Master Volume: <span id="mv-val">100%</span>')
        expect(html).toContain('aria-label="Master volume" aria-valuetext="100%"')
        expect(html).toContain('SFX Volume: <span id="sv-val">100%</span>')
        expect(html).toContain('aria-label="SFX volume" aria-valuetext="100%"')
        expect(html).toContain('Music Volume: <span id="muv-val">100%</span>')
        expect(html).toContain('aria-label="Music volume" aria-valuetext="100%"')
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should expose the options panel as an accessible dialog', () => {
      vi.stubGlobal('document', {})
      const mockDom = createMockDomLayer()
      const TestLayer = buildTestLayer(mockDom)
      return Effect.gen(function* () {
        yield* SettingsOverlayService
        const html = mockDom.setInnerHTML.mock.calls[0]?.[1]
        expect(mockDom.elements.overlay.getAttribute('role')).toBe('dialog')
        expect(mockDom.elements.overlay.getAttribute('aria-modal')).toBe('true')
        expect(mockDom.elements.overlay.getAttribute('aria-labelledby')).toBe('settings-overlay-title')
        expect(mockDom.elements.overlay.getAttribute('aria-describedby')).toBe('settings-overlay-description')
        expect(html).toContain('id="settings-overlay-title"')
        expect(html).toContain('id="settings-overlay-description"')
        expect(html).toContain('Changes apply immediately. Use Done to return.')
        expect(html).toContain('aria-label="Close settings"')
        expect(mockDom.elements.gearBtn.getAttribute('aria-label')).toBe('Open options')
        expect(mockDom.elements.gearBtn.getAttribute('aria-haspopup')).toBe('dialog')
        expect(mockDom.elements.gearBtn.getAttribute('aria-controls')).toBe('settings-overlay')
      }).pipe(Effect.provide(TestLayer))
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
