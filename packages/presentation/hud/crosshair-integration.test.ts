import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect, vi } from 'vitest'
import { CrosshairService, DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { createMockDomLayer } from './crosshair-test-utils'

describe('CrosshairService', () => {
  describe('with mocked DOM', () => {
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
      const mockDom = DomOperationsService.of({
        _tag: '@minecraft/presentation/DomOperations' as const,
        createElement: vi.fn(),
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        getParentNode: vi.fn(),
        appendChildTo: vi.fn(),
        setInnerHTML: vi.fn(),
        querySelector: vi.fn(),
      })

      expect(mockDom).toBeDefined()
    })
  })
})
