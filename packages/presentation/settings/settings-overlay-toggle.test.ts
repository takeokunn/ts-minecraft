import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect } from 'effect'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings/settings-overlay'
import { buildTestLayer, createMockDomLayer, createMockSettingsLayer } from './settings-overlay-test-utils'

afterEach(() => {
  vi.unstubAllGlobals()
})

type KeyboardHandler = (event: KeyboardEvent) => void

const makeKeyboardEvent = (key: string, shiftKey = false): KeyboardEvent => ({
  key,
  shiftKey,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
}) as unknown as KeyboardEvent

const stubKeyboardDocument = (initialActiveElement: Element | null) => {
  let activeElement = initialActiveElement
  const keydownHandlers: Array<KeyboardHandler> = []
  const documentStub = {
    get activeElement() {
      return activeElement
    },
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      if (type === 'keydown') keydownHandlers.push(handler as unknown as KeyboardHandler)
    }),
    removeEventListener: vi.fn(),
  }

  return {
    documentStub,
    getKeydownHandler: (): KeyboardHandler => {
      const handler = keydownHandlers[keydownHandlers.length - 1]
      expect(handler).toBeDefined()
      return handler as KeyboardHandler
    },
    setActiveElement: (element: Element | null): void => {
      activeElement = element
    },
  }
}

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

    it.scoped('should focus the first setting on open and restore previous focus on close', () => {
      const mockDom = createMockDomLayer()
      const keyboardDocument = stubKeyboardDocument(mockDom.elements.gearBtn as unknown as Element)
      vi.stubGlobal('document', keyboardDocument.documentStub)
      mockDom.elements.qualitySelect.focus.mockImplementation(() => {
        keyboardDocument.setActiveElement(mockDom.elements.qualitySelect as unknown as Element)
      })
      mockDom.elements.gearBtn.focus.mockImplementation(() => {
        keyboardDocument.setActiveElement(mockDom.elements.gearBtn as unknown as Element)
      })
      const TestLayer = buildTestLayer(mockDom)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        const opened = yield* overlay.toggle()
        expect(opened).toBe(true)
        expect(mockDom.elements.overlay.style.display).toBe('block')
        expect(mockDom.elements.qualitySelect.focus).toHaveBeenCalledTimes(1)
        expect(keyboardDocument.documentStub.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))

        const closed = yield* overlay.toggle()
        expect(closed).toBe(false)
        expect(mockDom.elements.overlay.style.display).toBe('none')
        expect(mockDom.elements.gearBtn.focus).toHaveBeenCalledTimes(1)
        expect(keyboardDocument.documentStub.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should close on Escape and restore focus', () => {
      const mockDom = createMockDomLayer()
      const keyboardDocument = stubKeyboardDocument(mockDom.elements.gearBtn as unknown as Element)
      vi.stubGlobal('document', keyboardDocument.documentStub)
      mockDom.elements.qualitySelect.focus.mockImplementation(() => {
        keyboardDocument.setActiveElement(mockDom.elements.qualitySelect as unknown as Element)
      })
      mockDom.elements.gearBtn.focus.mockImplementation(() => {
        keyboardDocument.setActiveElement(mockDom.elements.gearBtn as unknown as Element)
      })
      const TestLayer = buildTestLayer(mockDom)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        const event = makeKeyboardEvent('Escape')
        keyboardDocument.getKeydownHandler()(event)
        const open = yield* overlay.isOpen()
        expect(event.preventDefault).toHaveBeenCalled()
        expect(event.stopPropagation).toHaveBeenCalled()
        expect(open).toBe(false)
        expect(mockDom.elements.overlay.style.display).toBe('none')
        expect(mockDom.elements.gearBtn.focus).toHaveBeenCalledTimes(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should wrap Tab from Done to the first setting', () => {
      const mockDom = createMockDomLayer()
      const keyboardDocument = stubKeyboardDocument(mockDom.elements.gearBtn as unknown as Element)
      vi.stubGlobal('document', keyboardDocument.documentStub)
      const TestLayer = buildTestLayer(mockDom)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        keyboardDocument.setActiveElement(mockDom.elements.closeBtn as unknown as Element)
        mockDom.elements.qualitySelect.focus.mockClear()
        const event = makeKeyboardEvent('Tab')
        keyboardDocument.getKeydownHandler()(event)
        expect(event.preventDefault).toHaveBeenCalled()
        expect(mockDom.elements.qualitySelect.focus).toHaveBeenCalledTimes(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should wrap Shift+Tab from the first setting to Done', () => {
      const mockDom = createMockDomLayer()
      const keyboardDocument = stubKeyboardDocument(mockDom.elements.gearBtn as unknown as Element)
      vi.stubGlobal('document', keyboardDocument.documentStub)
      const TestLayer = buildTestLayer(mockDom)
      return Effect.gen(function* () {
        const overlay = yield* SettingsOverlayService
        yield* overlay.toggle()
        keyboardDocument.setActiveElement(mockDom.elements.qualitySelect as unknown as Element)
        const event = makeKeyboardEvent('Tab', true)
        keyboardDocument.getKeydownHandler()(event)
        expect(event.preventDefault).toHaveBeenCalled()
        expect(mockDom.elements.closeBtn.focus).toHaveBeenCalledTimes(1)
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
