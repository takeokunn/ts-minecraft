import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Match, Option } from 'effect'
import { MenuOption } from '../types'
import { createMainMenuController } from './main-menu'

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
      const next = yield* controller.cycle('next')
      expect(next).toBe('NewGame')

      yield* controller.selectOption('NewGame')
      const previous = yield* controller.cycle('previous')
      expect(previous).toBe('Exit')
    })
  )

  it.effect('clearSelection removes current choice', () =>
    Effect.gen(function* () {
      const controller = yield* createMainMenuController()
      yield* controller.selectOption('Settings')
      yield* controller.clearSelection()
      const current = yield* controller.current()
      expect(current.selectedOption).toStrictEqual(Option.none())
    })
  )
})
