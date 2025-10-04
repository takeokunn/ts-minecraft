import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import { MenuOption } from '../types'
import { createMainMenuController } from './main_menu'

const options: ReadonlyArray<MenuOption> = ['NewGame', 'LoadGame', 'Settings', 'Exit']

describe('domain/scene/scenes/main_menu', () => {
  it.effect('selectOption stores selected menu entry', () =>
    Effect.gen(function* () {
      const controller = yield* createMainMenuController()
      const selected = yield* controller.selectOption('Settings')
      expect(selected).toBe('Settings')
      const current = yield* controller.current()
      expect(current.selectedOption).toStrictEqual(Option.some('Settings'))
    })
  )

  it.effect('cycle rotates options', () =>
    Effect.gen(function* () {
      const controller = yield* createMainMenuController()
      yield* controller.selectOption('NewGame')
      const next = yield* controller.cycle('next')
      expect(next).toBe('LoadGame')
      const prev = yield* controller.cycle('previous')
      expect(prev).toBe('NewGame')
    })
  )

  it.effect('cycle wraps around without leaving option set', () =>
    Effect.gen(function* () {
      const controller = yield* createMainMenuController()
      yield* controller.selectOption('Exit')

      const wrappedNext = yield* controller.cycle('next')
      expect(wrappedNext).toBe('NewGame')

      const wrappedPrevious = yield* controller.cycle('previous')
      expect(wrappedPrevious).toBe('Exit')

      const current = yield* controller.current()
      expect(current.selectedOption).toStrictEqual(Option.some('Exit'))

      fc.assert(
        fc.property(
          fc.array(fc.constantFrom<'next' | 'previous'>('next', 'previous'), { minLength: 1, maxLength: 10 }),
          (directions) => {
            const result = Effect.runSync(
              Effect.gen(function* () {
                yield* controller.reset()
                for (const direction of directions) {
                  yield* controller.cycle(direction)
                }
                return yield* controller.current()
              })
            )

            const selected = Option.getOrElse(result.selectedOption, () => 'NewGame')
            expect(options.includes(selected)).toBe(true)
          }
        )
      )
    })
  )

  it.effect('clearSelection removes current choice', () =>
    Effect.gen(function* () {
      const controller = yield* createMainMenuController()
      yield* controller.selectOption('Settings')

      yield* controller.clearSelection()
      const afterClear = yield* controller.current()
      expect(afterClear.selectedOption).toStrictEqual(Option.none())

      yield* controller.clearSelection()
      const afterIdempotent = yield* controller.current()
      expect(afterIdempotent.selectedOption).toStrictEqual(Option.none())
    })
  )
})
