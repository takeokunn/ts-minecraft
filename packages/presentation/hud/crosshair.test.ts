import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { expect } from 'vitest'
import { CrosshairService } from '@ts-minecraft/presentation/hud/crosshair'
import { createMockDomLayer } from './crosshair-test-utils'

describe('CrosshairService', () => {
  describe('with mocked DOM', () => {
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

      it.effect('should do nothing when element has no parent node (onNone branch)', () => {
        const { TestLayer, removeChildMock, getParentNodeMock } = createMockDomLayer()
        getParentNodeMock.mockReturnValue(Option.none<HTMLElement>())

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.hide()

          // getParentNode returns none → removeChild is NOT called
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
          const visible1 = yield* crosshair.isVisible()
          expect(visible1).toBe(false)

          // Toggle to show
          yield* crosshair.toggle()
          const visible2 = yield* crosshair.isVisible()
          expect(visible2).toBe(true)

          // Toggle to hide
          yield* crosshair.toggle()
          const visible3 = yield* crosshair.isVisible()
          expect(visible3).toBe(false)

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
  })
})
