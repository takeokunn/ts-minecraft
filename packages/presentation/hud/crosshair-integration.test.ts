import { describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { expect, vi } from 'vitest'
import { CrosshairService, CrosshairLive, DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

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
            ;(element as { children: unknown[] }).children.push(child)
            return child
          }),
        }
        createdElements.push(element as typeof createdElements[0])
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
        } as DomOperationsService
      )

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
      } as DomOperationsService

      expect(mockDom).toBeDefined()
    })
  })
})
