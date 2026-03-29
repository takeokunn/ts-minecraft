import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { expect, vi } from 'vitest'
import { CrosshairService, CrosshairLive, DomOperationsService } from './crosshair'

describe('CrosshairService', () => {
  describe('with mocked DOM', () => {
    const createMockDomLayer = () => {
      const appendChildMock = vi.fn()
      const removeChildMock = vi.fn()
      const createElementMock = vi.fn()
      const getParentNodeMock = vi.fn()
      const createdElements: Array<{ id: string; style: { cssText: string }; children: unknown[]; parentNode: unknown | null }> = []

      createElementMock.mockImplementation((_tagName: string) => {
        const element = {
          id: '',
          style: { cssText: '' },
          children: [] as unknown[],
          parentNode: null as unknown | null,
          appendChild: vi.fn((child: unknown) => {
            ;(element as unknown as { children: unknown[] }).children.push(child)
            return child
          }),
        }
        createdElements.push(element as unknown as typeof createdElements[0])
        return element
      })

      appendChildMock.mockImplementation((element: unknown) => {
        ;(element as { parentNode: unknown | null }).parentNode = 'body'
        return element
      })

      removeChildMock.mockImplementation((element: unknown) => {
        ;(element as { parentNode: unknown | null }).parentNode = null
        return element
      })

      getParentNodeMock.mockImplementation((element: unknown) => {
        return Option.fromNullable((element as { parentNode: HTMLElement | null }).parentNode)
      })

      const MockDomLayer = Layer.succeed(
        DomOperationsService,
        {
          createElement: createElementMock,
          appendChild: appendChildMock,
          removeChild: removeChildMock,
          getParentNode: getParentNodeMock,
        } as unknown as DomOperationsService
      )

      // Provide the mock DOM layer to CrosshairLive
      const TestLayer = CrosshairLive.pipe(Layer.provide(MockDomLayer))

      return {
        TestLayer,
        appendChildMock,
        removeChildMock,
        createElementMock,
        getParentNodeMock,
        getCreatedElements: () => createdElements,
      }
    }

    describe('show', () => {
      it.effect('should append crosshair element to document body', () => {
        const { TestLayer, appendChildMock } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()

          expect(appendChildMock).toHaveBeenCalledTimes(1)
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should set visible to true after show', () => {
        const { TestLayer } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          const result = yield* crosshair.isVisible()

          expect(result).toBe(true)
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should not append element twice if already visible', () => {
        const { TestLayer, appendChildMock } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.show()

          expect(appendChildMock).toHaveBeenCalledTimes(1)
        }).pipe(Effect.provide(TestLayer))
      })
    })

    describe('hide', () => {
      it.effect('should remove crosshair element from document body when visible', () => {
        const { TestLayer, removeChildMock } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.hide()

          expect(removeChildMock).toHaveBeenCalledTimes(1)
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should set visible to false after hide', () => {
        const { TestLayer } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.hide()
          const result = yield* crosshair.isVisible()

          expect(result).toBe(false)
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should do nothing if not visible', () => {
        const { TestLayer, removeChildMock } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.hide()

          expect(removeChildMock).not.toHaveBeenCalled()
        }).pipe(Effect.provide(TestLayer))
      })
    })

    describe('toggle', () => {
      it.effect('should show crosshair when hidden', () => {
        const { TestLayer, appendChildMock } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.toggle()
          const result = yield* crosshair.isVisible()

          expect(result).toBe(true)
          expect(appendChildMock).toHaveBeenCalled()
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should hide crosshair when visible', () => {
        const { TestLayer, removeChildMock } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.toggle()
          const result = yield* crosshair.isVisible()

          expect(result).toBe(false)
          expect(removeChildMock).toHaveBeenCalled()
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should toggle visibility correctly through multiple cycles', () => {
        const { TestLayer, appendChildMock, removeChildMock } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService

          // Initially hidden
          let visible = yield* crosshair.isVisible()
          expect(visible).toBe(false)

          // Toggle to show
          yield* crosshair.toggle()
          visible = yield* crosshair.isVisible()
          expect(visible).toBe(true)

          // Toggle to hide
          yield* crosshair.toggle()
          visible = yield* crosshair.isVisible()
          expect(visible).toBe(false)

          // Toggle to show again
          yield* crosshair.toggle()
          const result = yield* crosshair.isVisible()

          expect(result).toBe(true)
          expect(appendChildMock).toHaveBeenCalledTimes(2)
          expect(removeChildMock).toHaveBeenCalledTimes(1)
        }).pipe(Effect.provide(TestLayer))
      })
    })

    describe('isVisible', () => {
      it.effect('should return false initially', () => {
        const { TestLayer } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          const result = yield* crosshair.isVisible()

          expect(result).toBe(false)
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should return true after show', () => {
        const { TestLayer } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          const result = yield* crosshair.isVisible()

          expect(result).toBe(true)
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should return false after hide', () => {
        const { TestLayer } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.hide()
          const result = yield* crosshair.isVisible()

          expect(result).toBe(false)
        }).pipe(Effect.provide(TestLayer))
      })
    })

    describe('element structure', () => {
      it.effect('should create crosshair element with correct id', () => {
        const { TestLayer, getCreatedElements } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()

          const elements = getCreatedElements()
          // First element is the container (crosshair)
          expect(Option.getOrThrow(Arr.get(elements, 0)).id).toBe('crosshair')
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should create two line elements (horizontal and vertical)', () => {
        const { TestLayer, getCreatedElements } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()

          const elements = getCreatedElements()
          // First element is the container, next two are the lines
          expect(elements.length).toBe(3)
          // The container should have 2 children
          expect(Option.getOrThrow(Arr.get(elements, 0)).children.length).toBe(2)
        }).pipe(Effect.provide(TestLayer))
      })
    })

    describe('integration', () => {
      it.effect('should handle show -> hide -> show cycle correctly', () => {
        const { TestLayer, appendChildMock, removeChildMock } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService

          // Show
          yield* crosshair.show()
          expect(yield* crosshair.isVisible()).toBe(true)

          // Hide
          yield* crosshair.hide()
          expect(yield* crosshair.isVisible()).toBe(false)

          // Show again
          yield* crosshair.show()
          const result = yield* crosshair.isVisible()

          expect(result).toBe(true)
          expect(appendChildMock).toHaveBeenCalledTimes(2)
          expect(removeChildMock).toHaveBeenCalledTimes(1)
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should maintain correct visibility state through multiple operations', () => {
        const { TestLayer } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService

          const states: boolean[] = []

          states.push(yield* crosshair.isVisible()) // false

          yield* crosshair.show()
          states.push(yield* crosshair.isVisible()) // true

          yield* crosshair.toggle()
          states.push(yield* crosshair.isVisible()) // false

          yield* crosshair.toggle()
          states.push(yield* crosshair.isVisible()) // true

          yield* crosshair.hide()
          states.push(yield* crosshair.isVisible()) // false

          yield* crosshair.show()
          states.push(yield* crosshair.isVisible()) // true

          expect(states).toEqual([false, true, false, true, false, true])
        }).pipe(Effect.provide(TestLayer))
      })
    })
  })

  describe('DomOperationsService', () => {
    it('should create a valid mock layer', () => {
      const mockDom = {
        createElement: vi.fn(),
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        getParentNode: vi.fn(),
      } as unknown as DomOperationsService

      expect(mockDom).toBeDefined()
    })
  })
})
