import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Deferred, Duration, Effect, Layer, MutableRef, Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { DEFAULT_PLAYER_ID, type Position, DeltaTimeSecs } from '@ts-minecraft/core'
import { GameModeService, GameStateService } from '@ts-minecraft/game'
import { HealthService } from '@ts-minecraft/entity/application/health-service'
import { DeathScreenService } from './death-screen'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'

vi.mock('@ts-minecraft/app/main/session-control', async () => {
  const actual = await vi.importActual<typeof import('@ts-minecraft/app/main/session-control')>(
    '@ts-minecraft/app/main/session-control',
  )

  return {
    ...actual,
    setPaused: vi.fn((control: SessionControl, paused: boolean) => actual.setPaused(control, paused)),
    requestQuitToTitle: vi.fn((control: SessionControl) => actual.requestQuitToTitle(control)),
  }
})

type MockElement = {
  id: string
  tagName: string
  textContent: string | null
  readonly style: { cssText: string; display?: string }
  readonly dataset: Record<string, string>
  readonly children: MockElement[]
  parentNode: MockElement | null
  parentElement: MockElement | null
  readonly attributes: Record<string, string>
  readonly listeners: Record<string, Array<() => void>>
  appendChild: (child: MockElement) => MockElement
  removeChild: (child: MockElement) => MockElement
  setAttribute: (name: string, value: string) => void
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
  click: () => void
  focus: () => void
}

type MockDocument = {
  activeElement: MockElement | null
  readonly listeners: Record<string, Array<(event: KeyboardEvent) => void>>
  addEventListener: (type: string, listener: (event: KeyboardEvent) => void, capture?: boolean) => void
  removeEventListener: (type: string, listener: (event: KeyboardEvent) => void, capture?: boolean) => void
  dispatchKeyDown: (key: string) => void
}

const makeElement = (tagName: string, documentRef: MockDocument): MockElement => {
  const element: MockElement = {
    id: '',
    tagName,
    textContent: null,
    style: { cssText: '' },
    dataset: {},
    children: [],
    parentNode: null,
    parentElement: null,
    attributes: {},
    listeners: {},
    appendChild: (child) => {
      child.parentNode = element
      child.parentElement = element
      element.children.push(child)
      return child
    },
    removeChild: (child) => {
      const index = element.children.indexOf(child)
      if (index >= 0) element.children.splice(index, 1)
      child.parentNode = null
      child.parentElement = null
      return child
    },
    setAttribute: (name, value) => {
      element.attributes[name] = value
    },
    addEventListener: (type, listener) => {
      const listeners = element.listeners[type] ?? (element.listeners[type] = [])
      listeners.push(listener)
    },
    removeEventListener: (type, listener) => {
      const listeners = element.listeners[type]
      if (listeners === undefined) return
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    },
    click: () => {
      const listeners = element.listeners.click ?? []
      listeners.forEach((listener) => listener())
    },
    focus: () => {
      documentRef.activeElement = element
    },
  }
  return element
}

const makeDocument = (): MockDocument => {
  const listeners: MockDocument['listeners'] = {}
  return {
    activeElement: null,
    listeners,
    addEventListener: (type, listener) => {
      const current = listeners[type] ?? (listeners[type] = [])
      current.push(listener)
    },
    removeEventListener: (type, listener) => {
      const current = listeners[type]
      if (current === undefined) return
      const index = current.indexOf(listener)
      if (index >= 0) current.splice(index, 1)
    },
    dispatchKeyDown: (key) => {
      const event = {
        key,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent
      for (const listener of listeners.keydown ?? []) {
        listener(event)
      }
    },
  }
}

const makeDom = (documentRef: MockDocument) => {
  const roots: MockElement[] = []
  const created: MockElement[] = []
  const createElement = vi.fn((tagName: string) => {
    const element = makeElement(tagName, documentRef)
    created.push(element)
    return element as unknown as HTMLElement
  })
  const appendChild = vi.fn((element: HTMLElement) => {
    roots.push(element as unknown as MockElement)
  })
  const appendChildTo = vi.fn((parent: HTMLElement, child: HTMLElement) => {
    (parent as unknown as MockElement).appendChild(child as unknown as MockElement)
  })
  const removeChild = vi.fn((element: HTMLElement) => {
    const mock = element as unknown as MockElement
    mock.parentNode?.removeChild(mock)
  })
  const getParentNode = vi.fn((element: HTMLElement) =>
    Option.fromNullable((element as unknown as MockElement).parentElement as unknown as HTMLElement | null),
  )
  const setInnerHTML = vi.fn((element: HTMLElement, html: string) => {
    void element
    void html
  })
  const querySelector = vi.fn(<T extends HTMLElement>() => Option.none<T>())

  return {
    roots,
    created,
    service: DomOperationsService.of({
      _tag: '@minecraft/presentation/DomOperations' as const,
      createElement: createElement as unknown as DomOperationsService['createElement'],
      appendChild,
      appendChildTo,
      removeChild,
      getParentNode,
      setInnerHTML,
      querySelector: querySelector as DomOperationsService['querySelector'],
    }),
  }
}

const makeGameStateLayer = () => {
  const respawn = vi.fn((_spawnPosition: Position) => Effect.void)
  const getPlayerPosition = vi.fn((_playerId: typeof DEFAULT_PLAYER_ID) =>
    Effect.succeed({ x: 12, y: 63, z: -8 } as Position),
  )

  return {
    respawn,
    getPlayerPosition,
    layer: Layer.succeed(
      GameStateService,
      GameStateService.of({
        _tag: '@minecraft/application/GameStateService' as const,
        initialize: () => Effect.void,
        update: (_deltaTime: DeltaTimeSecs) => Effect.void,
        respawn,
        setPlayerPosition: () => Effect.void,
        getTiming: () =>
          Effect.succeed({
            lastFrameTime: 0,
            deltaTime: DeltaTimeSecs.make(0.016),
            frameCount: 0,
          }),
        getPlayerPosition,
        getCameraRotation: () => Effect.succeed({ yaw: 0, pitch: 0 }),
        isPlayerGrounded: () => Effect.succeed(true),
      }),
    ),
  }
}

const makeGameModeLayer = (mode: 'survival' | 'creative') =>
  Layer.succeed(
    GameModeService,
    GameModeService.of({
      _tag: '@minecraft/application/GameModeService' as const,
      get: () => Effect.succeed(mode),
      set: () => Effect.void,
      isCreative: () => Effect.succeed(mode === 'creative'),
      isSurvival: () => Effect.succeed(mode === 'survival'),
      isSpectator: () => Effect.succeed(false),
    }),
  )

  const makeSessionControl = (): Effect.Effect<SessionControl, never> =>
    Effect.gen(function* () {
      return {
        isPausedRef: MutableRef.make(false),
        quitToTitleSignal: yield* Deferred.make<void, never>(),
      }
    })

const makeTestLayer = (documentRef: MockDocument, mode: 'survival' | 'creative') => {
  const dom = makeDom(documentRef)
  const gameState = makeGameStateLayer()
  return {
    dom,
    gameState,
    layer: DeathScreenService.Default.pipe(
      Layer.provide(gameState.layer),
      Layer.provide(makeGameModeLayer(mode)),
      Layer.provideMerge(HealthService.Default),
      Layer.provide(Layer.succeed(DomOperationsService, dom.service)),
    ),
  }
}

describe('DeathScreenService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('opens on survival death and respawns from the respawn button', async () => {
    const documentRef = makeDocument()
    vi.stubGlobal('document', documentRef as unknown as Document)
    const { dom, gameState, layer } = makeTestLayer(documentRef, 'survival')

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const control = yield* makeSessionControl()
          const respawnPositionRef = MutableRef.make({ x: 20, y: 80, z: -3 } as Position)
          const health = yield* HealthService
          const service = yield* DeathScreenService

          yield* service.attach(control, respawnPositionRef)
          yield* health.applyDamage(100, { kind: 'fall' })
          yield* Effect.sleep(Duration.millis(1))

          const backdrop = dom.roots[0]
          const message = dom.created.find((element) => element.dataset.role === 'death-message')
          const respawnBtn = dom.created.find((element) => element.dataset.role === 'respawn')
          expect(yield* service.isOpen()).toBe(true)
          expect(backdrop?.style.display).toBe('flex')
          expect(message?.textContent).toBe('You hit the ground too hard.')
          expect(respawnBtn).toBeDefined()
          expect(MutableRef.get(control.isPausedRef)).toBe(true)

          respawnBtn?.click()
          yield* Effect.sleep(Duration.millis(1))

          expect(yield* service.isOpen()).toBe(false)
          expect(backdrop?.style.display).toBe('none')
          expect(gameState.respawn).toHaveBeenCalledWith({ x: 20, y: 80, z: -3 })
          expect(MutableRef.get(control.isPausedRef)).toBe(false)
        }).pipe(Effect.provide(layer)),
      ),
    )
  })

  it('does not open the overlay after a creative death', async () => {
    const documentRef = makeDocument()
    vi.stubGlobal('document', documentRef as unknown as Document)
    const { dom, layer } = makeTestLayer(documentRef, 'creative')

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const control = yield* makeSessionControl()
          const respawnPositionRef = MutableRef.make({ x: 0, y: 64, z: 0 } as Position)
          const health = yield* HealthService
          const service = yield* DeathScreenService

          yield* service.attach(control, respawnPositionRef)
          yield* health.applyDamage(100)
          yield* Effect.sleep(Duration.millis(1))

          expect(yield* service.isOpen()).toBe(false)
          expect(dom.roots[0]?.style.display).not.toBe('flex')
          expect(MutableRef.get(control.isPausedRef)).toBe(false)
        }).pipe(Effect.provide(layer)),
      ),
    )
  })

  it('routes Enter on the quit button to quit-to-title', async () => {
    const documentRef = makeDocument()
    vi.stubGlobal('document', documentRef as unknown as Document)
    const { dom, layer } = makeTestLayer(documentRef, 'survival')

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const control = yield* makeSessionControl()
          const respawnPositionRef = MutableRef.make({ x: 4, y: 70, z: 4 } as Position)
          const health = yield* HealthService
          const service = yield* DeathScreenService

          yield* service.attach(control, respawnPositionRef)
          yield* health.applyDamage(100)
          yield* Effect.sleep(Duration.millis(1))

          const quitBtn = dom.created.find((element) => element.dataset.role === 'quit-to-title')
          expect(quitBtn).toBeDefined()
          quitBtn?.focus()
          documentRef.dispatchKeyDown('Enter')
          yield* Effect.sleep(Duration.millis(1))

          expect(yield* service.isOpen()).toBe(false)
          expect(dom.roots[0]?.style.display).toBe('none')
          expect(documentRef.activeElement).toBe(quitBtn ?? null)
        }).pipe(Effect.provide(layer)),
      ),
    )
  })
})
