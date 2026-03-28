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
      it('should append crosshair element to document body', () => {
        const { TestLayer, appendChildMock } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
        })

        Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(appendChildMock).toHaveBeenCalledTimes(1)
      })

      it('should set visible to true after show', () => {
        const { TestLayer } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          return yield* crosshair.isVisible()
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toBe(true)
      })

      it('should not append element twice if already visible', () => {
        const { TestLayer, appendChildMock } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.show()
        })

        Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(appendChildMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('hide', () => {
      it('should remove crosshair element from document body when visible', () => {
        const { TestLayer, removeChildMock } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.hide()
        })

        Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(removeChildMock).toHaveBeenCalledTimes(1)
      })

      it('should set visible to false after hide', () => {
        const { TestLayer } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.hide()
          return yield* crosshair.isVisible()
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toBe(false)
      })

      it('should do nothing if not visible', () => {
        const { TestLayer, removeChildMock } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.hide()
        })

        Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(removeChildMock).not.toHaveBeenCalled()
      })
    })

    describe('toggle', () => {
      it('should show crosshair when hidden', () => {
        const { TestLayer, appendChildMock } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.toggle()
          return yield* crosshair.isVisible()
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toBe(true)
        expect(appendChildMock).toHaveBeenCalled()
      })

      it('should hide crosshair when visible', () => {
        const { TestLayer, removeChildMock } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.toggle()
          return yield* crosshair.isVisible()
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toBe(false)
        expect(removeChildMock).toHaveBeenCalled()
      })

      it('should toggle visibility correctly through multiple cycles', () => {
        const { TestLayer, appendChildMock, removeChildMock } = createMockDomLayer()

        const program = Effect.gen(function* () {
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
          return yield* crosshair.isVisible()
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toBe(true)
        expect(appendChildMock).toHaveBeenCalledTimes(2)
        expect(removeChildMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('isVisible', () => {
      it('should return false initially', () => {
        const { TestLayer } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          return yield* crosshair.isVisible()
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toBe(false)
      })

      it('should return true after show', () => {
        const { TestLayer } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          return yield* crosshair.isVisible()
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toBe(true)
      })

      it('should return false after hide', () => {
        const { TestLayer } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.hide()
          return yield* crosshair.isVisible()
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toBe(false)
      })
    })

    describe('element structure', () => {
      it('should create crosshair element with correct id', () => {
        const { TestLayer, getCreatedElements } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
        })

        Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        const elements = getCreatedElements()
        // First element is the container (crosshair)
        expect(Option.getOrThrow(Arr.get(elements, 0)).id).toBe('crosshair')
      })

      it('should create two line elements (horizontal and vertical)', () => {
        const { TestLayer, getCreatedElements } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
        })

        Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        const elements = getCreatedElements()
        // First element is the container, next two are the lines
        expect(elements.length).toBe(3)
        // The container should have 2 children
        expect(Option.getOrThrow(Arr.get(elements, 0)).children.length).toBe(2)
      })
    })

    describe('integration', () => {
      it('should handle show -> hide -> show cycle correctly', () => {
        const { TestLayer, appendChildMock, removeChildMock } = createMockDomLayer()

        const program = Effect.gen(function* () {
          const crosshair = yield* CrosshairService

          // Show
          yield* crosshair.show()
          expect(yield* crosshair.isVisible()).toBe(true)

          // Hide
          yield* crosshair.hide()
          expect(yield* crosshair.isVisible()).toBe(false)

          // Show again
          yield* crosshair.show()
          return yield* crosshair.isVisible()
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toBe(true)
        expect(appendChildMock).toHaveBeenCalledTimes(2)
        expect(removeChildMock).toHaveBeenCalledTimes(1)
      })

      it('should maintain correct visibility state through multiple operations', () => {
        const { TestLayer } = createMockDomLayer()

        const program = Effect.gen(function* () {
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

          return states
        })

        const result = Effect.runSync(program.pipe(Effect.provide(TestLayer)))

        expect(result).toEqual([false, true, false, true, false, true])
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
