import { Deferred, Effect, MutableRef, Option } from 'effect'
import { StorageService } from '@ts-minecraft/world'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { ConfirmDialogService } from '@ts-minecraft/presentation/menu/confirm-dialog'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings/settings-overlay'
import { buildMenuDOM } from './main-menu-dom'
import type { MainMenuChoice } from './main-menu-types'
export type { MainMenuChoice } from './main-menu-types'
import {
  makeMenuRefs,
  makeSetSubState,
  makeUpdateModeButton,
  makeCompleteWith,
  makeRefreshLoadList,
  makeOpenRenamePrompt,
  makeOpenDeleteConfirm,
  makeClickHandlers,
} from './main-menu-handlers'

// DOM built once at boot scope (acquireRelease) and show/hidden across sessions —
// re-creating DOM per visit would defeat the "menu outlives sessions" invariant.
// Esc returns to ROOT — no-op if already ROOT (menu has nowhere to exit to).
// Corrupt world rows render with only a Delete button (via listWorldMetadata { valid, corrupt }).

export class MainMenuService extends Effect.Service<MainMenuService>()(
  '@minecraft/presentation/MainMenu',
  {
    scoped: Effect.gen(function* () {
      const storageService = yield* StorageService
      const dom = yield* DomOperationsService
      const confirmDialog = yield* ConfirmDialogService
      const settingsOverlay = yield* SettingsOverlayService
      if (typeof document === 'undefined') {
        // SSR / non-browser: stub implementation that fails fast on use.
        // Boot-scope tests that don't touch the menu can still load the layer.
        return {
          show: (): Effect.Effect<MainMenuChoice, never> =>
            Effect.die(new Error('MainMenuService.show called in non-DOM environment')),
          hide: (): Effect.Effect<void, never> => Effect.void,
        }
      }

        const { overlay, rootCard, newWorldCard, loadWorldCard, multiplayerCard, howToPlayCard, buttons } = yield* Effect.acquireRelease(
          Effect.sync(() => buildMenuDOM(dom)),
          ({ overlay }) =>
            Effect.sync(() => {
              dom.removeChild(overlay)
            }),
      )

      // ---------- Mutable run-state for the active show() call ----------
      const refs = makeMenuRefs()

        const setSubState = makeSetSubState(refs, rootCard, newWorldCard, loadWorldCard, multiplayerCard, howToPlayCard)
      const updateModeButton = makeUpdateModeButton(refs, buttons)
      const completeWith = makeCompleteWith(refs)

      const openDeleteConfirm = makeOpenDeleteConfirm(
        storageService,
        confirmDialog,
        () => refreshLoadList(),
      )
      const openRenamePrompt = makeOpenRenamePrompt(
        storageService,
        () => refreshLoadList(),
      )

      const refreshLoadList = makeRefreshLoadList(
        dom,
        storageService,
        buttons,
        refs,
        completeWith,
        openDeleteConfirm,
        openRenamePrompt,
      )

      const openSettings = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const open = yield* settingsOverlay.isOpen()
          if (!open) yield* settingsOverlay.toggle()
        })

        const handlers = makeClickHandlers(
          refs,
          buttons,
          setSubState,
        updateModeButton,
        completeWith,
        openSettings,
        refreshLoadList,
      )

        const {
          onNewWorldClick, onLoadWorldClick, onMultiplayerClick, onHowToPlayClick,
          onSettingsClick, onNwModeClick, onNwCancelClick, onNwConfirmClick,
          onContinueWorldClick,
          onLwBackClick, onMpCancelClick, onMpConfirmClick, onHowToPlayCloseClick, onEsc,
        } = handlers

      yield* Effect.acquireRelease(
        Effect.sync(() => {
            buttons.newWorld.addEventListener('click', onNewWorldClick)
            buttons.loadWorld.addEventListener('click', onLoadWorldClick)
            buttons.multiplayer.addEventListener('click', onMultiplayerClick)
            buttons.howToPlay.addEventListener('click', onHowToPlayClick)
            buttons.settings.addEventListener('click', onSettingsClick)
            buttons.nwMode.addEventListener('click', onNwModeClick)
            buttons.nwCancel.addEventListener('click', onNwCancelClick)
            buttons.nwConfirm.addEventListener('click', onNwConfirmClick)
            buttons.continueWorld.addEventListener('click', onContinueWorldClick)
            buttons.lwBack.addEventListener('click', onLwBackClick)
            buttons.mpCancel.addEventListener('click', onMpCancelClick)
            buttons.mpConfirm.addEventListener('click', onMpConfirmClick)
            buttons.howToPlayClose.addEventListener('click', onHowToPlayCloseClick)
          }),
        () =>
          Effect.sync(() => {
              buttons.newWorld.removeEventListener('click', onNewWorldClick)
              buttons.loadWorld.removeEventListener('click', onLoadWorldClick)
              buttons.multiplayer.removeEventListener('click', onMultiplayerClick)
              buttons.howToPlay.removeEventListener('click', onHowToPlayClick)
              buttons.settings.removeEventListener('click', onSettingsClick)
              buttons.nwMode.removeEventListener('click', onNwModeClick)
              buttons.nwCancel.removeEventListener('click', onNwCancelClick)
              buttons.nwConfirm.removeEventListener('click', onNwConfirmClick)
              buttons.continueWorld.removeEventListener('click', onContinueWorldClick)
              buttons.lwBack.removeEventListener('click', onLwBackClick)
              buttons.mpCancel.removeEventListener('click', onMpCancelClick)
              buttons.mpConfirm.removeEventListener('click', onMpConfirmClick)
              buttons.howToPlayClose.removeEventListener('click', onHowToPlayCloseClick)
              Option.map(MutableRef.get(refs.escHandlerRef), (handler) => {
                window.removeEventListener('keydown', handler)
            })
          }),
      )

      // The floating settings gear is redundant while the main menu is open (the
      // menu has its own Options... entry) AND during pointer-lock gameplay (vanilla
      // never floats a settings button there). It is kept hidden across both; the
      // pause menu re-shows it while paused. See pause-menu.ts.
      const setSettingsGearVisible = (visible: boolean): void => {
        const gear = document.getElementById('settings-gear-btn')
        if (gear !== null) gear.style.display = visible ? '' : 'none'
      }

      return {
        show: (): Effect.Effect<MainMenuChoice, never> =>
          Effect.gen(function* () {
            const deferred = yield* Deferred.make<MainMenuChoice, never>()
            yield* Effect.sync(() => {
              MutableRef.set(refs.activeDeferredRef, Option.some(deferred))
              setSubState('root')
              overlay.style.display = 'flex'
              setSettingsGearVisible(false)
              // Attach Esc listener for the duration of the show.
              Option.map(MutableRef.get(refs.escHandlerRef), (handler) => window.removeEventListener('keydown', handler))
              MutableRef.set(refs.escHandlerRef, Option.some(onEsc))
              window.addEventListener('keydown', onEsc)
            })
            yield* refreshLoadList()
            yield* Effect.sync(() => {
              const recentWorld = MutableRef.get(refs.recentWorldRef)
              const focusTarget = Option.isSome(recentWorld) ? buttons.continueWorld : buttons.newWorld
              focusTarget.focus()
            })
            return yield* Deferred.await(deferred)
          }),
        hide: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            overlay.style.display = 'none'
            // Entering gameplay: keep the gear hidden. The pause menu shows it when paused.
            setSettingsGearVisible(false)
            Option.map(MutableRef.get(refs.escHandlerRef), (handler) => {
              window.removeEventListener('keydown', handler)
            })
            MutableRef.set(refs.escHandlerRef, Option.none())
          }),
      }
    }),
  },
) {}
