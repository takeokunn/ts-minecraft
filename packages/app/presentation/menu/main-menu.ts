import { Deferred, Effect, MutableRef, Option } from 'effect'
import { StorageService } from '@ts-minecraft/world-state'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import { ConfirmDialogService } from '@ts-minecraft/app/presentation/menu/confirm-dialog'
import { WorldId } from '@ts-minecraft/kernel'
import type { GameMode } from '@ts-minecraft/game'
import { buildMenuDOM } from './main-menu-dom'
import {
  makeMenuRefs,
  makeSetSubState,
  makeUpdateModeButton,
  makeCompleteWith,
  makeRefreshLoadList,
  makeOpenDeleteConfirm,
  makeClickHandlers,
} from './main-menu-handlers'

// DOM built once at boot scope (acquireRelease) and show/hidden across sessions —
// re-creating DOM per visit would defeat the "menu outlives sessions" invariant.
// Esc returns to ROOT — no-op if already ROOT (menu has nowhere to exit to).
// Corrupt world rows render with only a Delete button (via listWorldMetadata { valid, corrupt }).

export type MainMenuChoice =
  | { readonly action: 'newWorld'; readonly worldId: WorldId; readonly gameMode: GameMode }
  | { readonly action: 'loadWorld'; readonly worldId: WorldId }

export class MainMenuService extends Effect.Service<MainMenuService>()(
  '@minecraft/presentation/MainMenu',
  {
    scoped: Effect.flatMap(
      Effect.all([StorageService, DomOperationsService, ConfirmDialogService], { concurrency: 'unbounded' }),
      ([storageService, dom, confirmDialog]) => {
        if (typeof document === 'undefined') {
          // SSR / non-browser: stub implementation that fails fast on use.
          // Boot-scope tests that don't touch the menu can still load the layer.
          return Effect.succeed({
            show: (): Effect.Effect<MainMenuChoice, never> =>
              Effect.die(new Error('MainMenuService.show called in non-DOM environment')),
            hide: (): Effect.Effect<void, never> => Effect.void,
          })
        }

        return Effect.acquireRelease(
          Effect.sync(() => buildMenuDOM(dom)),
          ({ overlay }) =>
            Effect.sync(() => {
              dom.removeChild(overlay)
            }),
        ).pipe(
          Effect.flatMap(({ overlay, rootCard, newWorldCard, loadWorldCard, buttons }) => {
            // ---------- Mutable run-state for the active show() call ----------
            const refs = makeMenuRefs()

            const setSubState = makeSetSubState(refs, rootCard, newWorldCard, loadWorldCard)
            const updateModeButton = makeUpdateModeButton(refs, buttons)
            const completeWith = makeCompleteWith(refs)

            const openDeleteConfirm = makeOpenDeleteConfirm(
              storageService,
              confirmDialog,
              () => refreshLoadList(),
            )

            const refreshLoadList = makeRefreshLoadList(
              dom,
              storageService,
              buttons,
              completeWith,
              openDeleteConfirm,
            )

            const handlers = makeClickHandlers(
              refs,
              buttons,
              setSubState,
              updateModeButton,
              completeWith,
              refreshLoadList,
            )

            const {
              onNewWorldClick, onLoadWorldClick,
              onNwModeClick, onNwCancelClick, onNwConfirmClick, onLwBackClick, onEsc,
            } = handlers

            return Effect.acquireRelease(
              Effect.sync(() => {
                buttons.newWorld.addEventListener('click', onNewWorldClick)
                buttons.loadWorld.addEventListener('click', onLoadWorldClick)
                buttons.nwMode.addEventListener('click', onNwModeClick)
                buttons.nwCancel.addEventListener('click', onNwCancelClick)
                buttons.nwConfirm.addEventListener('click', onNwConfirmClick)
                buttons.lwBack.addEventListener('click', onLwBackClick)
              }),
              () =>
                Effect.sync(() => {
                  buttons.newWorld.removeEventListener('click', onNewWorldClick)
                  buttons.loadWorld.removeEventListener('click', onLoadWorldClick)
                  buttons.nwMode.removeEventListener('click', onNwModeClick)
                  buttons.nwCancel.removeEventListener('click', onNwCancelClick)
                  buttons.nwConfirm.removeEventListener('click', onNwConfirmClick)
                  buttons.lwBack.removeEventListener('click', onLwBackClick)
                  Option.map(MutableRef.get(refs.escHandlerRef), (handler) => {
                    window.removeEventListener('keydown', handler)
                  })
                }),
            ).pipe(
              Effect.as({
                show: (): Effect.Effect<MainMenuChoice, never> =>
                  Effect.gen(function* () {
                    const deferred = yield* Deferred.make<MainMenuChoice, never>()
                    yield* Effect.sync(() => {
                      MutableRef.set(refs.activeDeferredRef, Option.some(deferred))
                      setSubState('root')
                      overlay.style.display = 'flex'
                      // Attach Esc listener for the duration of the show.
                      Option.map(MutableRef.get(refs.escHandlerRef), (handler) => window.removeEventListener('keydown', handler))
                      MutableRef.set(refs.escHandlerRef, Option.some(onEsc))
                      window.addEventListener('keydown', onEsc)
                      buttons.newWorld.focus()
                    })
                    return yield* Deferred.await(deferred)
                  }),
                hide: (): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    overlay.style.display = 'none'
                    Option.map(MutableRef.get(refs.escHandlerRef), (handler) => {
                      window.removeEventListener('keydown', handler)
                    })
                    MutableRef.set(refs.escHandlerRef, Option.none())
                  }),
              }),
            )
          }),
        )
      },
    ),
  },
) {}

export const MainMenuLive = MainMenuService.Default
