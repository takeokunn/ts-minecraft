import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Match, Option } from 'effect'
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

  it.prop('cycle wraps around without leaving option set', [fc.integer({ min: 1, max: 20 })], ([steps]) =>
    Effect.gen(function* () {
      const controller = yield* createMainMenuController()

      const iterate = (remaining: number, current: MenuOption): Effect.Effect<MenuOption> =>
        Match.value(remaining).pipe(
          Match.when(0, () => Effect.succeed(current)),
          Match.orElse(() =>
            controller.cycle('next').pipe(
              Effect.flatMap((next) => iterate(remaining - 1, next))
            )
          )
        )

      const last = yield* iterate(steps, 'NewGame')
      expect(options.includes(last)).toBe(true)
      return true
    })
  )

  it.effect('clearSelection removes current choice', () =>
    Effect.gen(function* () {
      const controller = yield* createMainMenuController()
      yield* controller.selectOption('Exit')
      yield* controller.clearSelection()
      const current = yield* controller.current()
      expect(current.selectedOption).toStrictEqual(Option.none())
    })
  )
})
