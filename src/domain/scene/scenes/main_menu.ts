import { Effect, Match, Option } from 'effect'
import { pipe } from 'effect/Function'
import { MenuOption, SceneState as Scenes } from '..'
import {
  SceneBlueprint,
  SceneCleanupError,
  SceneContext,
  SceneController,
  SceneControllerError,
  SceneDefinition,
  SceneInitializationError,
  SceneLifecycleError,
  createSceneController,
  makeSceneLayer,
  mapControllerFailure,
} from './index'

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

const optionIndex = (option: MenuOption) => {
  const index = menuOptions.indexOf(option)
  return index === -1 ? Option.none<number>() : Option.some(index)
}

const wrapIndex = (index: number) => ((index % menuOptions.length) + menuOptions.length) % menuOptions.length

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
  readonly clearSelection: () => Effect.Effect<void, SceneControllerError>
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
          .pipe(Effect.asVoid)

      return {
        ...controller,
        selectOption,
        cycle,
        clearSelection,
      }
    })
  )

type MainMenuState = ReturnType<typeof Scenes.MainMenu>

type MainMenuSceneContext = SceneContext<MainMenuState, MainMenuController>

interface MainMenuMetadata {
  readonly title: string
  readonly version: string
  readonly menuItems: ReadonlyArray<string>
}

const metadata: Readonly<MainMenuMetadata> = {
  title: 'TypeScript Minecraft Clone',
  version: '1.0.0',
  menuItems: ['新しいゲーム', '設定', '終了'],
}

const handleLifecycleFailure =
  (phase: SceneLifecycleError['phase']) =>
  (reason: string): SceneLifecycleError =>
    SceneLifecycleError({ sceneType: 'MainMenu', phase, message: reason })

const handleInitializationFailure = (reason: string): SceneInitializationError =>
  SceneInitializationError({ sceneType: 'MainMenu', message: reason })

const handleCleanupFailure = (reason: string): SceneCleanupError =>
  SceneCleanupError({ sceneType: 'MainMenu', message: reason })

const MainMenuBlueprint: SceneBlueprint<MainMenuState, MainMenuController> = {
  initial: Scenes.MainMenu(),
  controller: createMainMenuController(),
}

const setDefaultSelection = (context: MainMenuSceneContext) =>
  mapControllerFailure(context.controller.selectOption('NewGame'), handleInitializationFailure)

const ensureSelectionExists = (context: MainMenuSceneContext) =>
  Effect.gen(function* () {
    const current = yield* context.controller.current()
    yield* Option.match(current.selectedOption, {
      onNone: () => mapControllerFailure(context.controller.selectOption('NewGame'), handleLifecycleFailure('enter')),
      onSome: () => Effect.void,
    })
    return undefined
  })

const mainMenuDefinition: SceneDefinition<MainMenuState, MainMenuController> = {
  id: 'main-menu-001',
  type: 'MainMenu',
  metadata,
  blueprint: MainMenuBlueprint,
  onInitialize: (context) =>
    Effect.gen(function* () {
      yield* context.controller.reset()
      yield* setDefaultSelection(context)
      return undefined
    }),
  onEnter: (context) => ensureSelectionExists(context),
  onCleanup: (context) =>
    mapControllerFailure(context.controller.clearSelection(), handleCleanupFailure).pipe(Effect.asVoid),
}

export const MainMenuScene = makeSceneLayer(mainMenuDefinition)

export { MainMenuBlueprint }
export const MainMenuDefinition = mainMenuDefinition
