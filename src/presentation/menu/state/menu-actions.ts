import { Context, Effect, Layer } from 'effect'

import { MenuControllerService, type MenuControllerError } from './menu-controller'
import type { MenuViewModel } from './menu-view-model'

export interface MenuActions {
  readonly openMain: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly openPause: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly openSettings: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly close: () => Effect.Effect<MenuViewModel, MenuControllerError>
  readonly back: () => Effect.Effect<MenuViewModel, MenuControllerError>
}

export const MenuActionsTag = Context.GenericTag<MenuActions>(
  '@minecraft/presentation/menu/MenuActions'
)
export const MenuActionsService = MenuActionsTag

export const MenuActionsLive = Layer.effect(
  MenuActionsTag,
  Effect.gen(function* () {
    const controller = yield* MenuControllerService

    return MenuActionsTag.of({
      openMain: controller.openMain,
      openPause: controller.openPause,
      openSettings: controller.openSettings,
      close: controller.close,
      back: controller.back,
    })
  })
)
