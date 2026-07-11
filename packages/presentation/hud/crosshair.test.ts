import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Option } from 'effect'
import { expect, vi } from 'vitest'
import { CrosshairService } from '@ts-minecraft/presentation/hud/crosshair'
import { applyHudScale } from '@ts-minecraft/presentation/hud/hud-scale'
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

    describe('pulse', () => {
      it.effect('should apply and reset hit marker styling when visible', () => {
        vi.useFakeTimers()
        const { TestLayer, getCreatedElements } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()

          const element = Option.getOrThrow(Arr.get(getCreatedElements(), 0))
          const baseCss = element.style.cssText

          yield* crosshair.pulse()

          expect(element.style.cssText).toContain('scale(1.45)')
          expect(element.style.cssText).toContain('255, 70, 70')

          vi.advanceTimersByTime(120)

          expect(element.style.cssText).toBe(baseCss)
        }).pipe(
          Effect.provide(TestLayer),
          Effect.ensuring(Effect.sync(() => {
            vi.clearAllTimers()
            vi.useRealTimers()
          }))
        )
      })

      it.effect('should keep hidden crosshair at base styling', () => {
        const { TestLayer, appendChildMock, getCreatedElements } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService

          yield* crosshair.pulse()

          const element = Option.getOrThrow(Arr.get(getCreatedElements(), 0))
          expect(appendChildMock).not.toHaveBeenCalled()
          expect(element.style.cssText).toContain('scale(1)')
          expect(element.style.cssText).not.toContain('scale(1.45)')
        }).pipe(Effect.provide(TestLayer))
      })

      it.effect('should preserve the current HUD scale after pulse reset', () => {
        vi.useFakeTimers()
        applyHudScale(0.75)
        const { TestLayer, getCreatedElements } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()
          yield* crosshair.pulse()

          const element = Option.getOrThrow(Arr.get(getCreatedElements(), 0))
          expect(element.style.cssText).toContain('scale(1.0875)')

          vi.advanceTimersByTime(120)

          expect(element.style.cssText).toContain('scale(0.75)')
        }).pipe(
          Effect.provide(TestLayer),
          Effect.ensuring(Effect.sync(() => {
            applyHudScale(1)
            vi.clearAllTimers()
            vi.useRealTimers()
          }))
        )
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

      it.effect('should protect crosshair contrast against bright and dark backgrounds', () => {
        const { TestLayer, getCreatedElements } = createMockDomLayer()

        return Effect.gen(function* () {
          const crosshair = yield* CrosshairService
          yield* crosshair.show()

          const element = Option.getOrThrow(Arr.get(getCreatedElements(), 0))
          expect(element.style.cssText).toContain('mix-blend-mode: difference')
          expect(element.style.cssText).toContain('drop-shadow')
        }).pipe(Effect.provide(TestLayer))
      })
    })
  })
})
