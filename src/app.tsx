import type { ManagedRuntime } from 'effect/ManagedRuntime'
import { Effect, Either, Fiber, Match, Option, Schema, Stream, pipe } from 'effect'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import type { SliderSettingsOption, ToggleSettingsOption, SelectSettingsOption } from '@presentation/menu/types'
import type { MenuAction } from '@presentation/menu/types'
import {
  MenuActionsProvider,
  MenuControllerService,
  type MenuController,
  type MenuViewModel,
  MainMenu,
  PauseMenu,
  SettingsMenu,
  useMenuActions,
} from '@presentation/menu'
import { InputService, InputTimestamp, KeyCode, KeyCodeSchema } from '@domain/input'
import { HUDOverlay } from '@presentation/hud'
import { InventoryPanel } from '@presentation/inventory'
import {
  InventoryOpened,
  type InventoryEventHandler,
  type InventoryGUIEvent,
} from '@presentation/inventory/adt'
import { useGameUI } from '@presentation/hooks/useGameUI'

import './style.css'

type Runtime = ManagedRuntime<unknown, unknown>

const useMenuController = (runtime: Runtime) => {
  const controllerRef = useRef<MenuController | null>(null)
  const initFiberRef = useRef<Fiber.RuntimeFiber<void, never> | null>(null)
  const streamFiberRef = useRef<Fiber.RuntimeFiber<void, never> | null>(null)
  const [model, setModel] = useState<MenuViewModel | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const effect = Effect.gen(function* () {
      const controller = yield* MenuControllerService
      const viewModel = yield* controller.openMain()
      return { controller, viewModel }
    })

    const handleSuccess = ({ controller, viewModel }: { controller: MenuController; viewModel: MenuViewModel }) =>
      pipe(
        Match.value(cancelled),
        Match.when(true, () => undefined),
        Match.orElse(() => {
          controllerRef.current = controller
          setModel(viewModel)
          setErrorMessage(null)

          const streamEffect = controller.stream().pipe(
            Stream.runForEach((next) =>
              Effect.sync(() => {
                setModel(next)
                setErrorMessage(null)
              })
            )
          )

          const fiber = runtime.runFork(streamEffect)
          streamFiberRef.current = fiber
        }),
        Match.exhaustive
      )

    const handleFailure = (error: unknown) =>
      pipe(
        Match.value(cancelled),
        Match.when(true, () => undefined),
        Match.orElse(() => {
          console.error('メニュー初期化エラー', error)
          setErrorMessage('メニューの初期化に失敗しました')
        }),
        Match.exhaustive
      )

    const initFiber = runtime.runFork(
      effect.pipe(
        Effect.matchEffect({
          onFailure: (error) => Effect.sync(() => handleFailure(error)),
          onSuccess: (result) => Effect.sync(() => handleSuccess(result)),
        })
      )
    )
    initFiberRef.current = initFiber

    return () => {
      cancelled = true
      pipe(
        Option.fromNullable(streamFiberRef.current),
        Match.value,
        Match.tag('None', () => undefined),
        Match.tag('Some', ({ value }) => {
          runtime.runFork(
            Fiber.interrupt(value).pipe(
              Effect.catchAll((interruptError) =>
                Effect.sync(() => console.error('メニューストリーム停止エラー', interruptError))
              )
            )
          )
        }),
        Match.exhaustive
      )

      pipe(
        Option.fromNullable(initFiberRef.current),
        Match.value,
        Match.tag('None', () => undefined),
        Match.tag('Some', ({ value }) => {
          runtime.runFork(Fiber.interrupt(value))
        }),
        Match.exhaustive
      )

      controllerRef.current = null
      streamFiberRef.current = null
      initFiberRef.current = null
    }
  }, [runtime])

  const runControllerEffect = useCallback(
    (effectFactory: (controller: MenuController) => Effect.Effect<MenuViewModel>) => {
      pipe(
        Option.fromNullable(controllerRef.current),
        Match.value,
        Match.tag('None', () => undefined),
        Match.tag('Some', ({ value: controller }) => {
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
        }),
        Match.exhaustive
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
  const openPause = useCallback(() => runControllerEffect((controller) => controller.openPause()), [runControllerEffect])
  const openSettingsMenu = useCallback(
    () => runControllerEffect((controller) => controller.openSettings()),
    [runControllerEffect]
  )

  const ingestKeyEvent = useCallback(
    (event: KeyboardEvent, tag: 'KeyPressed' | 'KeyReleased') => {
      const toKeyCode = (keyboardEvent: KeyboardEvent): Option.Option<string> =>
        pipe(
          keyboardEvent.code,
          Match.value,
          Match.when((code) => code.startsWith('Key'), Option.some),
          Match.when((code) => code.startsWith('Digit'), Option.some),
          Match.when((code) => code === 'Space', () => Option.some('Space')),
          Match.orElse((code) => Option.some(code.toUpperCase())),
          Match.exhaustive
        )

      pipe(
        toKeyCode(event),
        Match.value,
        Match.tag('None', () => undefined),
        Match.tag('Some', ({ value: candidate }) => {
          const keyOption = pipe(
            Schema.decodeEither(KeyCodeSchema)(candidate),
            Either.match({
              onLeft: () => Option.none<ReturnType<typeof KeyCode>>(),
              onRight: Option.some,
            })
          )

          return pipe(
            keyOption,
            Match.value,
            Match.tag('None', () => undefined),
            Match.tag('Some', ({ value: key }) => {
              const inputEvent = pipe(
                Match.value(tag),
                Match.when('KeyPressed', () => ({
                  _tag: 'KeyPressed' as const,
                  timestamp: InputTimestamp(Date.now()),
                  key,
                  modifiers: {
                    shift: event.shiftKey,
                    ctrl: event.ctrlKey,
                    alt: event.altKey,
                    meta: event.metaKey,
                  },
                })),
                Match.orElse(() => ({
                  _tag: 'KeyReleased' as const,
                  timestamp: InputTimestamp(Date.now()),
                  key,
                  modifiers: {
                    shift: event.shiftKey,
                    ctrl: event.ctrlKey,
                    alt: event.altKey,
                    meta: event.metaKey,
                  },
                })),
                Match.exhaustive
              )

              const sendEffect = Effect.gen(function* () {
                const input = yield* InputService
                return yield* input.ingest(inputEvent)
              })

              runtime.runFork(
                sendEffect.pipe(
                  Effect.catchAll((error) =>
                    Effect.sync(() => console.error('入力イベント送信エラー', error))
                  )
                )
              )
            }),
            Match.exhaustive
          )
        }),
        Match.exhaustive
      )
    },
    [runtime]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) =>
      pipe(
        Match.value(event.repeat),
        Match.when(true, () => undefined),
        Match.orElse(() => ingestKeyEvent(event, 'KeyPressed')),
        Match.exhaustive
      )

    const handleKeyUp = (event: KeyboardEvent) => ingestKeyEvent(event, 'KeyReleased')

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
    pipe(
      Option.fromNullable(inventory.handler),
      Option.match({
        onNone: () => undefined,
        onSome: (handler) => runInventoryHandler(handler, InventoryOpened({})),
      })
    )
  }, [inventory.handler, runInventoryHandler])

  const resolvedInventoryHandler: InventoryEventHandler = inventory.handler ?? (() => Effect.void)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) =>
      pipe(
        Match.value(event.key),
        Match.when('Escape', () => {
          event.preventDefault()
          return pipe(
            Option.fromNullable(model),
            Match.value,
            Match.tag('None', () => openPause()),
            Match.tag('Some', ({ value }) =>
              pipe(
                Match.value(value.route),
                Match.when('none', () => openPause()),
                Match.when('settings', () => onBack()),
                Match.orElse(() => onClose()),
                Match.exhaustive
              )
            ),
            Match.exhaustive
          )
        }),
        Match.orElse(() => undefined),
        Match.exhaustive
      )

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [model, onBack, onClose, openPause])

  const renderModel = (current: MenuViewModel) => {
    const routeContent = pipe(
      Match.value(current.route),
      Match.when('main', () => <MainMenu actions={current.mainActions} onSelect={onMainSelect} />),
      Match.when('pause', () => (
        <PauseMenu
          actions={current.pauseActions}
          onSelect={onPauseSelect}
          title="Paused"
          sessionName="Sandbox World"
        />
      )),
      Match.when('settings', () => (
        <SettingsOverlay
          model={current}
          onToggle={onToggle}
          onSlider={onSlider}
          onSelect={onSelect}
          onBack={onBack}
          onReset={onReset}
        />
      )),
      Match.orElse(() => null),
      Match.exhaustive
    )

    const showCloseButton = pipe(
      Match.value(current.route),
      Match.when('none', () => false),
      Match.orElse(() => true),
      Match.exhaustive
    )

    const showMenuButton = pipe(
      Match.value(current.route),
      Match.when('none', () => true),
      Match.orElse(() => false),
      Match.exhaustive
    )

    return (
      <>
        {routeContent}
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
        cameraStatus={hud.camera ?? undefined}
        onOpenSettings={openSettingsMenu}
        onOpenInventory={handleOpenInventory}
      />
    </div>
  ) : null

  const inventoryPanelNode = inventory.panel?.isOpen
    ? (
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
      )
    : null

  const menuNode = pipe(
    Option.fromNullable(errorMessage),
    Match.value,
    Match.tag('Some', ({ value }) => (
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
        {value}
      </div>
    )),
    Match.tag('None', () =>
      pipe(
        Option.fromNullable(model),
        Match.value,
        Match.tag('None', () => null),
        Match.tag('Some', ({ value }) => renderModel(value)),
        Match.exhaustive
      )
    ),
    Match.exhaustive
  )

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
        {menuNode}
      </div>
    </MenuActionsProvider>
  )
}

export function initApp(runtime: Runtime): void {
  pipe(
    Option.fromNullable(document.querySelector<HTMLDivElement>('#app')),
    Match.value,
    Match.tag('None', () => {
      console.error('アプリケーションコンテナが見つかりません')
    }),
    Match.tag('Some', ({ value: container }) => {
      const root = createRoot(container)
      root.render(<MenuApp runtime={runtime} />)
    }),
    Match.exhaustive
  )
}
