
import { Effect, Match, Option, pipe } from 'effect'
import { MenuOption, SceneState as Scenes } from '../types'
import { SceneBlueprint, SceneController, SceneControllerError, createSceneController, makeBlueprint } from './base'

const menuOptions: ReadonlyArray<MenuOption> = ['NewGame', 'LoadGame', 'Settings', 'Exit']

const ensureOption = (option: MenuOption) =>
  pipe(
    menuOptions.find((candidate) => candidate === option),
    Option.fromNullable,
    Option.match({
      onNone: () =>
        Effect.fail(
          SceneControllerError.InvalidMutation({
            reason: `未登録のメニュー項目です: ${option}`,
          })
        ),
      onSome: (value) => Effect.succeed(value),
    })
  )

const optionIndex = (option: MenuOption) =>
  Match.value(menuOptions.findIndex((candidate) => candidate === option)).pipe(
    Match.when((index) => index < 0, () => Option.none<number>()),
    Match.orElse((index) => Option.some(index))
  )

const wrapIndex = (index: number) =>
  ((index % menuOptions.length) + menuOptions.length) % menuOptions.length

const ensureSelection = (selection: Option.Option<MenuOption>) =>
  Option.match(selection, {
    onNone: () =>
      Effect.fail(
        SceneControllerError.InvalidMutation({
          reason: 'メニュー選択状態が存在しません',
        })
      ),
    onSome: (value) => Effect.succeed(value),
  })

export interface MainMenuController extends SceneController<ReturnType<typeof Scenes.MainMenu>> {
  readonly selectOption: (option: MenuOption) => Effect.Effect<MenuOption, SceneControllerError>
  readonly cycle: (direction: 'next' | 'previous') => Effect.Effect<MenuOption, SceneControllerError>
  readonly clearSelection: () => Effect.Effect<void>
}

export const createMainMenuController = (): Effect.Effect<MainMenuController> =>
  createSceneController(Scenes.MainMenu()).pipe(
    Effect.map((controller) => {
      const selectOption = (option: MenuOption) =>
        ensureOption(option).pipe(
          Effect.flatMap((verified) =>
            controller.update((state) => ({
              ...state,
              selectedOption: Option.some(verified),
            }))
          ),
          Effect.flatMap((state) => ensureSelection(state.selectedOption))
        )

      const cycle = (direction: 'next' | 'previous') =>
        controller
          .update((state) => {
            const currentIndex = pipe(
              state.selectedOption,
              Option.flatMap(optionIndex),
              Option.getOrElse(() => 0)
            )

            const delta = Match.value(direction).pipe(
              Match.when('next', () => 1),
              Match.when('previous', () => -1),
              Match.exhaustive
            )

            const rotated = menuOptions[wrapIndex(currentIndex + delta)]

            return {
              ...state,
              selectedOption: Option.some(rotated),
            }
          })
          .pipe(Effect.flatMap((state) => ensureSelection(state.selectedOption)))

      const clearSelection = () =>
        controller
          .update((state) => ({
            ...state,
            selectedOption: Option.none(),
          }))
          .pipe(Effect.asUnit)

      return {
        ...controller,
        selectOption,
        cycle,
        clearSelection,
      }
    })
  )

export const MainMenuBlueprint: SceneBlueprint<ReturnType<typeof Scenes.MainMenu>> = makeBlueprint(
  Scenes.MainMenu()
)
