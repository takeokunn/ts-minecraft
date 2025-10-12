import { GameApplication, type GameApplicationStateError } from '@application/game-application'
import {
  SettingsApplicationService,
  type SettingsApplicationError,
  type SettingsOptionUpdate,
  type SettingsMenuModel,
} from '@application/settings'
import { Context, Effect, Layer, Match, Ref, Stream, SubscriptionRef } from 'effect'

import type { MenuAction, MenuRoute } from '../types'
import { MenuStateStoreTag } from './menu-store'
import type { MenuViewModel } from './menu-view-model'

const MAIN_MENU_ACTIONS: ReadonlyArray<MenuAction> = [
  {
    id: 'main:new-game',
    label: '新しいゲーム',
    description: '新規ワールドを開始します（準備中）',
    disabled: true,
  },
  {
    id: 'main:settings',
    label: '設定',
    description: '描画・操作・デバッグ設定を変更します',
  },
  {
    id: 'main:exit',
    label: '終了',
    description: 'メニューを閉じます',
  },
] as const

const PAUSE_MENU_ACTIONS: ReadonlyArray<MenuAction> = [
  {
    id: 'pause:resume',
    label: '再開',
    description: 'ゲームに戻ります',
  },
  {
    id: 'pause:settings',
    label: '設定',
    description: '設定メニューを開きます',
  },
  {
    id: 'pause:exit-to-title',
    label: 'タイトルに戻る',
    description: 'メインメニューに戻ります',
  },
] as const

const createViewModel = (route: MenuRoute, settings: SettingsMenuModel): MenuViewModel => ({
  route,
  mainActions: MAIN_MENU_ACTIONS,
  pauseActions: PAUSE_MENU_ACTIONS,
  settings,
})

type MenuControllerError = SettingsApplicationError | GameApplicationStateError

export interface MenuController {
  readonly model: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly stream: () => Stream.Stream<MenuViewModel>
  readonly openMain: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly openPause: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly openSettings: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly close: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly back: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly updateSetting: (update: SettingsOptionUpdate) => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly resetSettings: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly handleMainAction: (actionId: MenuAction['id']) => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly handlePauseAction: (actionId: MenuAction['id']) => Effect.Effect<MenuViewModel, MenuControllerError>
}

export const MenuControllerTag = Context.GenericTag<MenuController>(
  '@minecraft/presentation/menu/MenuController'
)
export const MenuControllerService = MenuControllerTag
export type { MenuControllerError }

const makeMenuController = Effect.gen(function* () {
  const menuState = yield* MenuStateStoreTag
  const settingsService = yield* SettingsApplicationService
  const gameApplication = yield* GameApplication

  const initialSettings = yield* settingsService.menuModel()
  const settingsRef = yield* Ref.make<SettingsMenuModel>(initialSettings)
  const initialRoute = yield* menuState.get
  const lastNonSettingsRoute =
    initialRoute === 'settings' || initialRoute === 'none' ? ('main' satisfies MenuRoute) : initialRoute
  const lastRouteRef = yield* Ref.make<MenuRoute>(lastNonSettingsRoute)
  const initialViewModel = createViewModel(initialRoute, initialSettings)
  const viewModelRef = yield* Ref.make(initialViewModel)
  const streamRef = yield* SubscriptionRef.make(initialViewModel)

  const publish = (model: MenuViewModel) =>
    Ref.set(viewModelRef, model).pipe(Effect.zipLeft(SubscriptionRef.set(streamRef, model)))

  const rebuild = (overrideRoute?: MenuRoute) =>
    Effect.gen(function* () {
      const route = overrideRoute ?? (yield* menuState.get)
      const settings = yield* Ref.get(settingsRef)
      const model = createViewModel(route, settings)
      yield* publish(model)
      return model
    })

  const updateLastRoute = (route: MenuRoute) =>
    Match.value(route).pipe(
      Match.when('settings', () => Effect.unit),
      Match.when('none', () => Effect.unit),
      Match.orElse(() => Ref.set(lastRouteRef, route))
    )

  const setRoute = (route: MenuRoute) =>
    updateLastRoute(route).pipe(Effect.flatMap(() => menuState.set(route)), Effect.flatMap(() => rebuild(route)))

  const closeMenu = () =>
    Effect.gen(function* () {
      const current = yield* menuState.get
      const lastRoute = yield* Ref.get(lastRouteRef)
      const shouldResume =
        current === 'pause' ||
        (current === 'settings' && lastRoute === 'pause') ||
        lastRoute === 'pause'
      yield* Match.value(shouldResume).pipe(
        Match.when(true, () => gameApplication.resume()),
        Match.orElse(() => Effect.void)
      )
      yield* menuState.close()
      return yield* rebuild('none')
    })

  const openMainMenu = () => setRoute('main')

  const openPauseMenu = () =>
    gameApplication.pause().pipe(
      Effect.flatMap(() => setRoute('pause'))
    )

  const openSettingsMenu = () =>
    Effect.gen(function* () {
      const settings = yield* settingsService.refresh()
      yield* Ref.set(settingsRef, settings)
      yield* menuState.set('settings')
      return yield* rebuild('settings')
    })

  const applySettingsUpdate = (update: SettingsOptionUpdate) =>
    Effect.gen(function* () {
      const settings = yield* settingsService.update(update)
      yield* Ref.set(settingsRef, settings)
      yield* menuState.set('settings')
      return yield* rebuild('settings')
    })

  const resetSettingsToDefault = () =>
    Effect.gen(function* () {
      const settings = yield* settingsService.reset()
      yield* Ref.set(settingsRef, settings)
      yield* menuState.set('settings')
      return yield* rebuild('settings')
    })

  const handleMainAction = (actionId: MenuAction['id']) =>
    Match.value(actionId).pipe(
      Match.when('main:new-game', () =>
        Effect.logInfo('新しいゲームの開始は現在準備中です').pipe(Effect.flatMap(() => closeMenu()))
      ),
      Match.when('main:settings', () => openSettingsMenu()),
      Match.when('main:exit', () => closeMenu()),
      Match.orElse(() => rebuild())
    )

  const handlePauseAction = (actionId: MenuAction['id']) =>
    Match.value(actionId).pipe(
      Match.when('pause:resume', () =>
        gameApplication.resume().pipe(
          Effect.flatMap(() => closeMenu())
        )
      ),
      Match.when('pause:settings', () => openSettingsMenu()),
      Match.when('pause:exit-to-title', () =>
        gameApplication.stop().pipe(
          Effect.flatMap(() => openMainMenu())
        )
      ),
      Match.orElse(() => rebuild())
    )

  const backFromSettings = () =>
    Effect.gen(function* () {
      const lastRoute = yield* Ref.get(lastRouteRef)
      return yield* Match.value(lastRoute).pipe(
        Match.when('pause', () => openPauseMenu()),
        Match.when('main', () => openMainMenu()),
        Match.when('settings', () => openMainMenu()),
        Match.when('none', () => closeMenu()),
        Match.orElse(() => openMainMenu())
      )
    })

  return MenuControllerTag.of({
    model: () => Ref.get(viewModelRef),
    stream: () => streamRef.changes,
    openMain: openMainMenu,
    openPause: openPauseMenu,
    openSettings: openSettingsMenu,
    close: () => closeMenu(),
    back: backFromSettings,
    updateSetting: applySettingsUpdate,
    resetSettings: () => resetSettingsToDefault(),
    handleMainAction: (actionId) => handleMainAction(actionId),
    handlePauseAction: (actionId) => handlePauseAction(actionId),
  })
})

export const MenuControllerLive = Layer.scoped(MenuControllerTag, makeMenuController)
