import { Effect, Either, Fiber, Schema, Stream } from 'effect'
import type { ManagedRuntime } from 'effect/ManagedRuntime'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { createRoot } from 'react-dom/client'

import { InputService, InputTimestamp, KeyCode, KeyCodeSchema } from '@domain/input'
import { useGameUI } from '@presentation/hooks/useGameUI'
import { HUDOverlay } from '@presentation/hud'
import { InventoryPanel } from '@presentation/inventory'
import { InventoryOpened, type InventoryEventHandler, type InventoryGUIEvent } from '@presentation/inventory/adt'
import {
  MainMenu,
  MenuActionsProvider,
  MenuControllerService,
  PauseMenu,
  SettingsMenu,
  useMenuActions,
  type MenuController,
  type MenuControllerError,
  type MenuViewModel,
} from '@presentation/menu'
import type {
  MenuAction,
  SelectSettingsOption,
  SliderSettingsOption,
  ToggleSettingsOption,
} from '@presentation/menu/types'

import './style.css'

type Runtime = ManagedRuntime<unknown, unknown>

const useMenuController = (runtime: Runtime) => {
  const controllerRef = useRef<MenuController | null>(null)
  const initFiberRef = useRef<Fiber.RuntimeFiber<void, unknown> | null>(null)
  const streamFiberRef = useRef<Fiber.RuntimeFiber<void, unknown> | null>(null)
  const [model, setModel] = useState<MenuViewModel | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const initializationEffect = Effect.gen(function* () {
      const controller = yield* MenuControllerService
      const viewModel = yield* controller.openMain()
      return { controller, viewModel }
    })

    const initFiber = runtime.runFork(
      initializationEffect.pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.sync(() => {
              if (cancelled) {
                return
              }
              console.error('メニュー初期化エラー', error)
              setErrorMessage('メニューの初期化に失敗しました')
            }),
          onSuccess: ({ controller, viewModel }) =>
            Effect.sync(() => {
              if (cancelled) {
                return
              }

              controllerRef.current = controller
              setModel(viewModel)
              setErrorMessage(null)

              const streamEffect = controller.stream().pipe(
                Stream.runForEach((next) =>
                  Effect.sync(() => {
                    if (cancelled) {
                      return
                    }
                    setModel(next)
                    setErrorMessage(null)
                  })
                )
              )

              streamFiberRef.current = runtime.runFork(streamEffect)
            }),
        })
      )
    )

    initFiberRef.current = initFiber

    return () => {
      cancelled = true

      const streamFiber = streamFiberRef.current
      if (streamFiber) {
        runtime.runFork(
          Fiber.interrupt(streamFiber).pipe(
            Effect.catchAll((interruptError) =>
              Effect.sync(() => console.error('メニューストリーム停止エラー', interruptError))
            )
          )
        )
      }

      const initFiberCurrent = initFiberRef.current
      if (initFiberCurrent) {
        runtime.runFork(Fiber.interrupt(initFiberCurrent))
      }

      controllerRef.current = null
      streamFiberRef.current = null
      initFiberRef.current = null
    }
  }, [runtime])

  const runControllerEffect = useCallback(
    (effectFactory: (controller: MenuController) => Effect.Effect<MenuViewModel, MenuControllerError, never>) => {
      const controller = controllerRef.current
      if (!controller) {
        return
      }

      setErrorMessage(null)

      runtime.runFork(
        effectFactory(controller).pipe(
          Effect.matchEffect({
            onFailure: (error) =>
              Effect.sync(() => {
                console.error('メニュー操作エラー', error)
                setErrorMessage('メニュー操作に失敗しました')
              }),
            onSuccess: (viewModel) =>
              Effect.sync(() => {
                setModel(viewModel)
              }),
          })
        )
      )
    },
    [runtime]
  )

  const handleMainSelect = useCallback(
    (action: MenuAction) => runControllerEffect((controller) => controller.handleMainAction(action.id)),
    [runControllerEffect]
  )

  const handlePauseSelect = useCallback(
    (action: MenuAction) => runControllerEffect((controller) => controller.handlePauseAction(action.id)),
    [runControllerEffect]
  )

  const handleToggle = useCallback(
    (option: ToggleSettingsOption, value: boolean) =>
      runControllerEffect((controller) =>
        controller.updateSetting({
          type: 'toggle',
          id: option.id,
          value,
        })
      ),
    [runControllerEffect]
  )

  const handleSlider = useCallback(
    (option: SliderSettingsOption, value: number) =>
      runControllerEffect((controller) =>
        controller.updateSetting({
          type: 'slider',
          id: option.id,
          value,
        })
      ),
    [runControllerEffect]
  )

  const handleSelect = useCallback(
    (option: SelectSettingsOption, value: string) =>
      runControllerEffect((controller) =>
        controller.updateSetting({
          type: 'select',
          id: option.id,
          value,
        })
      ),
    [runControllerEffect]
  )

  const handleBack = useCallback(() => runControllerEffect((controller) => controller.back()), [runControllerEffect])

  const handleReset = useCallback(
    () => runControllerEffect((controller) => controller.resetSettings()),
    [runControllerEffect]
  )

  const handleClose = useCallback(() => runControllerEffect((controller) => controller.close()), [runControllerEffect])

  const openMain = useCallback(() => runControllerEffect((controller) => controller.openMain()), [runControllerEffect])
  const openPause = useCallback(
    () => runControllerEffect((controller) => controller.openPause()),
    [runControllerEffect]
  )
  const openSettingsMenu = useCallback(
    () => runControllerEffect((controller) => controller.openSettings()),
    [runControllerEffect]
  )

  const ingestKeyEvent = useCallback(
    (event: KeyboardEvent, tag: 'KeyPressed' | 'KeyReleased') => {
      const { code } = event
      let candidate: string | null = null

      if (code.startsWith('Key') || code.startsWith('Digit')) {
        candidate = code
      } else if (code === 'Space') {
        candidate = 'Space'
      } else {
        candidate = code.toUpperCase()
      }

      const decoded = Schema.decodeEither(KeyCodeSchema)(candidate)
      if (Either.isLeft(decoded)) {
        return
      }

      const key = decoded.right
      const timestamp = InputTimestamp(Date.now())
      const modifiers = {
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey,
      }

      const inputEvent = tag === 'KeyPressed'
        ? {
            _tag: 'KeyPressed' as const,
            timestamp,
            key,
            modifiers,
          }
        : {
            _tag: 'KeyReleased' as const,
            timestamp,
            key,
            modifiers,
          }

      const sendEffect = Effect.gen(function* () {
        const input = yield* InputService
        return yield* input.ingest(inputEvent)
      })

      runtime.runFork(
        sendEffect.pipe(
          Effect.catchAll((error) => Effect.sync(() => console.error('入力イベント送信エラー', error)))
        )
      )
    },
    [runtime]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }
      ingestKeyEvent(event, 'KeyPressed')
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      ingestKeyEvent(event, 'KeyReleased')
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [ingestKeyEvent])

  return {
    model,
    errorMessage,
    onMainSelect: handleMainSelect,
    onPauseSelect: handlePauseSelect,
    onToggle: handleToggle,
    onSlider: handleSlider,
    onSelect: handleSelect,
    onBack: handleBack,
    onReset: handleReset,
    onClose: handleClose,
    openMain,
    openPause,
    openSettingsMenu,
  }
}

const SettingsOverlay = ({
  model,
  onToggle,
  onSlider,
  onSelect,
  onBack,
  onReset,
}: {
  readonly model: MenuViewModel
  readonly onToggle: (option: ToggleSettingsOption, value: boolean) => void
  readonly onSlider: (option: SliderSettingsOption, value: number) => void
  readonly onSelect: (option: SelectSettingsOption, value: string) => void
  readonly onBack: () => void
  readonly onReset: () => void
}) => (
  <>
    <SettingsMenu
      title="設定"
      categories={model.settings}
      onToggle={onToggle}
      onSliderChange={onSlider}
      onSelectChange={onSelect}
    />
    <div
      style={{
        position: 'absolute',
        top: '2rem',
        right: '2rem',
        display: 'flex',
        gap: '0.5rem',
      }}
    >
      <button
        type="button"
        onClick={onReset}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '10px',
          border: 'none',
          background: 'rgba(15,23,42,0.75)',
          color: '#f8fafc',
          cursor: 'pointer',
        }}
      >
        デフォルトに戻す
      </button>
      <button
        type="button"
        onClick={onBack}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '10px',
          border: 'none',
          background: '#38bdf8',
          color: '#0f172a',
          cursor: 'pointer',
        }}
      >
        戻る
      </button>
    </div>
  </>
)

const MenuDebugPanel = () => {
  const { openPause, openSettings, closeMenu } = useMenuActions()

  return (
    <aside
      style={{
        position: 'absolute',
        bottom: '1.5rem',
        right: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1rem',
        borderRadius: '12px',
        background: 'rgba(15, 23, 42, 0.75)',
        color: '#f8fafc',
      }}
    >
      <strong style={{ fontSize: '0.85rem', opacity: 0.8 }}>Debug Controls</strong>
      <button
        type="button"
        onClick={openPause}
        style={{
          padding: '0.4rem 0.75rem',
          borderRadius: '8px',
          border: 'none',
          background: '#38bdf8',
          color: '#0f172a',
          cursor: 'pointer',
        }}
      >
        Pause Menu
      </button>
      <button
        type="button"
        onClick={openSettings}
        style={{
          padding: '0.4rem 0.75rem',
          borderRadius: '8px',
          border: 'none',
          background: 'rgba(148, 163, 184, 0.35)',
          color: '#f8fafc',
          cursor: 'pointer',
        }}
      >
        Settings Menu
      </button>
      <button
        type="button"
        onClick={closeMenu}
        style={{
          padding: '0.4rem 0.75rem',
          borderRadius: '8px',
          border: 'none',
          background: 'rgba(248, 113, 113, 0.3)',
          color: '#fee2e2',
          cursor: 'pointer',
        }}
      >
        Close Menu
      </button>
    </aside>
  )
}

const MenuApp = ({ runtime }: { readonly runtime: Runtime }) => {
  const {
    model,
    errorMessage,
    onMainSelect,
    onPauseSelect,
    onToggle,
    onSlider,
    onSelect,
    onBack,
    onReset,
    onClose,
    openMain,
    openPause,
    openSettingsMenu,
  } = useMenuController(runtime)
  const { hud, inventory } = useGameUI(runtime)

  const runInventoryHandler = useCallback(
    (handler: InventoryEventHandler, event: InventoryGUIEvent) => {
      runtime.runFork(
        handler(event).pipe(
          Effect.catchAllCause((cause) => Effect.logError(cause)),
          Effect.asVoid
        )
      )
    },
    [runtime]
  )

  const handleOpenInventory = useCallback(() => {
    const handler = inventory.handler
    if (handler) {
      runInventoryHandler(handler, InventoryOpened())
    }
  }, [inventory.handler, runInventoryHandler])

  const resolvedInventoryHandler: InventoryEventHandler = inventory.handler ?? (() => Effect.void)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()

      if (!model) {
        openPause()
        return
      }

      switch (model.route) {
        case 'none':
          openPause()
          return
        case 'settings':
          onBack()
          return
        default:
          onClose()
          return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [model, onBack, onClose, openPause])

  const renderModel = (current: MenuViewModel) => {
    let content: JSX.Element | null = null

    switch (current.route) {
      case 'main':
        content = <MainMenu actions={current.mainActions} onSelect={onMainSelect} />
        break
      case 'pause':
        content = (
          <PauseMenu
            actions={current.pauseActions}
            onSelect={onPauseSelect}
            title="Paused"
            sessionName="Sandbox World"
          />
        )
        break
      case 'settings':
        content = (
          <SettingsOverlay
            model={current}
            onToggle={onToggle}
            onSlider={onSlider}
            onSelect={onSelect}
            onBack={onBack}
            onReset={onReset}
          />
        )
        break
      default:
        content = null
    }

    const showCloseButton = current.route !== 'none'
    const showMenuButton = current.route === 'none'

    return (
      <>
        {content}
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1.5rem',
              left: '1.5rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(15, 23, 42, 0.75)',
              color: '#f8fafc',
              cursor: 'pointer',
            }}
          >
            閉じる
          </button>
        ) : null}
        {showMenuButton ? (
          <button
            type="button"
            onClick={openMain}
            style={{
              position: 'absolute',
              top: '1.5rem',
              left: '1.5rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(15, 23, 42, 0.75)',
              color: '#f8fafc',
              cursor: 'pointer',
            }}
          >
            メニュー
          </button>
        ) : null}
      </>
    )
  }

  const hudNode = hud.player ? (
    <div
      style={{
        position: 'absolute',
        left: '1.5rem',
        bottom: '1.5rem',
      }}
    >
      <HUDOverlay
        model={hud.player}
        onOpenSettings={openSettingsMenu}
        onOpenInventory={handleOpenInventory}
        {...(hud.camera ? { cameraStatus: hud.camera } : {})}
      />
    </div>
  ) : null

  const inventoryPanelNode = inventory.panel?.isOpen ? (
    <div
      style={{
        position: 'absolute',
        right: '2rem',
        bottom: '2rem',
      }}
    >
      <InventoryPanel
        model={inventory.panel}
        onEvent={(event) => runInventoryHandler(resolvedInventoryHandler, event)}
      />
    </div>
  ) : null

  let menuContent: JSX.Element | null = null
  if (errorMessage) {
    menuContent = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.9)',
          color: '#f8fafc',
          fontSize: '1.25rem',
        }}
      >
        {errorMessage}
      </div>
    )
  } else if (model) {
    menuContent = renderModel(model)
  }

  const menuActions = {
    openMain,
    openPause,
    openSettings: openSettingsMenu,
    closeMenu: onClose,
    back: onBack,
  }

  return (
    <MenuActionsProvider value={menuActions}>
      <div
        style={{
          position: 'relative',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      >
        {hudNode}
        {inventoryPanelNode}
        <MenuDebugPanel />
        {menuContent}
      </div>
    </MenuActionsProvider>
  )
}

export function initApp(runtime: Runtime): void {
  const container = document.querySelector<HTMLDivElement>('#app')
  if (!container) {
    console.error('アプリケーションコンテナが見つかりません')
    return
  }

  const root = createRoot(container)
  root.render(<MenuApp runtime={runtime} />)
}
