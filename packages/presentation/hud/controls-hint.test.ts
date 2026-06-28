import { Effect, Layer, Option } from 'effect'
import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'

import { ControlsHintService } from '@ts-minecraft/presentation/hud/controls-hint'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

const createMockLocalStorage = () => {
  const store = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    store,
  }
}

const createMockDomLayer = () => {
  const createdElements: Array<{
    tagName: string
    id: string
    style: { cssText: string }
    children: unknown[]
    parentNode: unknown | null
    setAttribute: (name: string, value: string) => void
    appendChild: (child: unknown) => unknown
    addEventListener: (type: string, listener: () => void) => void
    click: () => void
  }> = []
  const appendChildMock = vi.fn((element: { parentNode: unknown | null }) => {
    element.parentNode = {}
  })
  const appendChildToMock = vi.fn((parent: { children: unknown[] }, child: unknown) => {
    parent.children.push(child)
    return child
  })
  const removeChildMock = vi.fn((element: { parentNode: unknown | null }) => {
    element.parentNode = null
  })
  const createElementMock = vi.fn((_tagName: string) => {
    const listeners = new Map<string, Array<() => void>>()
    const element = {
      tagName: _tagName.toUpperCase(),
      id: '',
      style: { cssText: '' },
      children: [] as unknown[],
      parentNode: null as unknown,
      setAttribute: vi.fn(),
      appendChild: vi.fn((child: unknown) => {
        element.children.push(child)
        return child
      }),
      addEventListener: vi.fn((type: string, listener: () => void) => {
        const nextListeners = listeners.get(type) ?? []
        nextListeners.push(listener)
        listeners.set(type, nextListeners)
      }),
      click: vi.fn(() => {
        for (const listener of listeners.get('click') ?? []) {
          listener()
        }
      }),
    }
    createdElements.push(element)
    return element
  })
  const getParentNodeMock = vi.fn((element: { parentNode: unknown | null }) => Option.fromNullable(element.parentNode))

  const MockDomLayer = Layer.succeed(
    DomOperationsService,
    DomOperationsService.of({
      _tag: '@minecraft/presentation/DomOperations' as const,
      createElement: createElementMock as DomOperationsService['createElement'],
      appendChild: appendChildMock as DomOperationsService['appendChild'],
      appendChildTo: appendChildToMock as DomOperationsService['appendChildTo'],
      removeChild: removeChildMock as DomOperationsService['removeChild'],
      getParentNode: getParentNodeMock as DomOperationsService['getParentNode'],
      setInnerHTML: vi.fn() as DomOperationsService['setInnerHTML'],
      querySelector: vi.fn(() => Option.none()) as DomOperationsService['querySelector'],
    })
  )

  const TestLayer = ControlsHintService.Default.pipe(Layer.provide(MockDomLayer))

  return { TestLayer, appendChildMock, appendChildToMock, removeChildMock, createdElements }
}

describe('ControlsHintService', () => {
  it.effect('shows, hides, and stays dismissed after hide', () => {
    const localStorageMock = createMockLocalStorage()
    const { TestLayer, appendChildMock, appendChildToMock, removeChildMock, createdElements } = createMockDomLayer()
    vi.stubGlobal('localStorage', localStorageMock)

    const firstSession = Effect.gen(function* () {
      const hint = yield* ControlsHintService

      expect(yield* hint.isVisible()).toBe(false)
      yield* hint.show()
      expect(yield* hint.isVisible()).toBe(true)
      yield* hint.show()
      expect(appendChildToMock).toHaveBeenCalledTimes(1)
      expect(createdElements[1]?.tagName).toBe('BUTTON')
      createdElements[1]?.click()
      expect(yield* hint.isVisible()).toBe(false)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('minecraft-controls-hint-dismissed', '1')
      yield* hint.show()
      yield* hint.hide()
      expect(yield* hint.isVisible()).toBe(false)
    }).pipe(Effect.provide(TestLayer))

    const secondSession = Effect.gen(function* () {
      const hint = yield* ControlsHintService

      expect(yield* hint.isVisible()).toBe(false)
      yield* hint.show()
      expect(yield* hint.isVisible()).toBe(false)
      yield* hint.toggle()
      expect(yield* hint.isVisible()).toBe(false)
    }).pipe(Effect.provide(TestLayer))

    return Effect.gen(function* () {
      yield* firstSession
      yield* secondSession

      expect(appendChildMock).toHaveBeenCalledTimes(1)
      expect(removeChildMock).toHaveBeenCalledTimes(1)
      expect(createdElements[0]?.id).toBe('controls-hint')
    }).pipe(
      Effect.ensuring(Effect.sync(() => {
        vi.unstubAllGlobals()
      }))
    )
  })

  it.effect('removes the hint when the layer scope closes', () => {
    const localStorageMock = createMockLocalStorage()
    const { TestLayer, appendChildMock, removeChildMock, createdElements } = createMockDomLayer()
    vi.stubGlobal('localStorage', localStorageMock)

    const session = Effect.gen(function* () {
      const hint = yield* ControlsHintService

      expect(yield* hint.isVisible()).toBe(false)
      yield* hint.show()
      expect(yield* hint.isVisible()).toBe(true)
    }).pipe(Effect.provide(TestLayer))

    return Effect.gen(function* () {
      yield* session

      expect(appendChildMock).toHaveBeenCalledTimes(1)
      expect(removeChildMock).toHaveBeenCalledTimes(1)
      expect(createdElements[0]?.id).toBe('controls-hint')
    }).pipe(
      Effect.ensuring(Effect.sync(() => {
        vi.unstubAllGlobals()
      }))
    )
  })
})
