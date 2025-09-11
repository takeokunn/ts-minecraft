import { Effect, Context, Ref } from 'effect'

/**
 * UI Controller
 * ユーザーインターフェース要素の制御を担当する薄いコントローラー層
 * HUD、メニュー、インベントリなどのUI状態管理
 * 
 * Note: Presentation層として、ビジネスロジックを含まず、UI状態の管理のみを行う
 */
export interface UIControllerInterface {
  readonly showHUD: (visible: boolean) => Effect.Effect<void, never, never>
  readonly showInventory: (visible: boolean) => Effect.Effect<void, never, never>
  readonly showMainMenu: (visible: boolean) => Effect.Effect<void, never, never>
  readonly showCrosshair: (visible: boolean) => Effect.Effect<void, never, never>
  readonly updateHotbar: (items: HotbarItem[]) => Effect.Effect<void, never, never>
  readonly showNotification: (message: string, duration?: number) => Effect.Effect<void, never, never>
  readonly getUIState: () => Effect.Effect<UIState, never, never>
}

export interface HotbarItem {
  readonly id: string
  readonly type: string
  readonly count: number
  readonly slot: number
}

export interface UIState {
  readonly hudVisible: boolean
  readonly inventoryVisible: boolean
  readonly mainMenuVisible: boolean
  readonly crosshairVisible: boolean
  readonly hotbarItems: HotbarItem[]
  readonly notifications: Notification[]
}

export interface Notification {
  readonly id: string
  readonly message: string
  readonly timestamp: number
  readonly duration: number
}

const UIControllerLive = Effect.gen(function* ($) {
  const uiStateRef = yield* $(Ref.make<UIState>({
    hudVisible: true,
    inventoryVisible: false,
    mainMenuVisible: false,
    crosshairVisible: true,
    hotbarItems: [],
    notifications: [],
  }))

  const showHUD = (visible: boolean) =>
    Effect.gen(function* ($) {
      yield* $(Ref.update(uiStateRef, (state) => ({
        ...state,
        hudVisible: visible,
      })))
      yield* $(Effect.log(`HUD: ${visible ? 'VISIBLE' : 'HIDDEN'}`))
    })

  const showInventory = (visible: boolean) =>
    Effect.gen(function* ($) {
      yield* $(Ref.update(uiStateRef, (state) => ({
        ...state,
        inventoryVisible: visible,
      })))
      yield* $(Effect.log(`Inventory: ${visible ? 'VISIBLE' : 'HIDDEN'}`))
    })

  const showMainMenu = (visible: boolean) =>
    Effect.gen(function* ($) {
      yield* $(Ref.update(uiStateRef, (state) => ({
        ...state,
        mainMenuVisible: visible,
      })))
      yield* $(Effect.log(`Main menu: ${visible ? 'VISIBLE' : 'HIDDEN'}`))
    })

  const showCrosshair = (visible: boolean) =>
    Effect.gen(function* ($) {
      yield* $(Ref.update(uiStateRef, (state) => ({
        ...state,
        crosshairVisible: visible,
      })))
      yield* $(Effect.log(`Crosshair: ${visible ? 'VISIBLE' : 'HIDDEN'}`))
    })

  const updateHotbar = (items: HotbarItem[]) =>
    Effect.gen(function* ($) {
      yield* $(Ref.update(uiStateRef, (state) => ({
        ...state,
        hotbarItems: items,
      })))
      yield* $(Effect.log(`Hotbar updated with ${items.length} items`))
    })

  const showNotification = (message: string, duration = 3000) =>
    Effect.gen(function* ($) {
      const notification: Notification = {
        id: `notification-${Date.now()}`,
        message,
        timestamp: Date.now(),
        duration,
      }

      yield* $(Ref.update(uiStateRef, (state) => ({
        ...state,
        notifications: [...state.notifications, notification],
      })))

      // 指定時間後に通知を削除
      yield* $(
        Effect.delay(
          Ref.update(uiStateRef, (state) => ({
            ...state,
            notifications: state.notifications.filter((n) => n.id !== notification.id),
          })),
          duration,
        ),
      )

      yield* $(Effect.log(`Notification shown: ${message}`))
    })

  const getUIState = () => Ref.get(uiStateRef)

  return {
    showHUD,
    showInventory,
    showMainMenu,
    showCrosshair,
    updateHotbar,
    showNotification,
    getUIState,
  }
})

export class UIController extends Context.GenericTag('UIController')<
  UIController,
  UIControllerInterface
>() {
  static readonly Live = UIControllerLive.pipe(Effect.map(UIController.of))
}