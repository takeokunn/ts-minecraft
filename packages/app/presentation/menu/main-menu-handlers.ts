import { Array as Arr, Cause, Deferred, Effect, MutableRef, Option, Order } from 'effect'
import { StorageService, type WorldMetadata } from '@ts-minecraft/world-state'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import { ConfirmDialogService } from '@ts-minecraft/app/presentation/menu/confirm-dialog'
import { WorldId } from '@ts-minecraft/kernel'
import type { GameMode } from '@ts-minecraft/game'
import type { MainMenuChoice } from './main-menu'
import type { SubState } from './main-menu-utils'
import { cycleGameMode, generateWorldId } from './main-menu-utils'
import type { MenuButtons } from './main-menu-dom'
import { renderValidRow, renderCorruptRow } from './main-menu-dom'

// --- Menu run-state refs bundled together ---

export interface MenuRefs {
  readonly subStateRef: MutableRef.MutableRef<SubState>
  readonly newWorldModeRef: MutableRef.MutableRef<GameMode>
  readonly activeDeferredRef: MutableRef.MutableRef<Option.Option<Deferred.Deferred<MainMenuChoice, never>>>
  readonly settingsHandlerRef: MutableRef.MutableRef<Option.Option<() => void>>
  readonly escHandlerRef: MutableRef.MutableRef<Option.Option<(ev: KeyboardEvent) => void>>
}

export const makeMenuRefs = (): MenuRefs => ({
  subStateRef: MutableRef.make<SubState>('root'),
  newWorldModeRef: MutableRef.make<GameMode>('survival'),
  activeDeferredRef: MutableRef.make<Option.Option<Deferred.Deferred<MainMenuChoice, never>>>(Option.none()),
  settingsHandlerRef: MutableRef.make<Option.Option<() => void>>(Option.none()),
  escHandlerRef: MutableRef.make<Option.Option<(ev: KeyboardEvent) => void>>(Option.none()),
})

// --- State helpers ---

export const makeSetSubState = (
  refs: MenuRefs,
  rootCard: HTMLDivElement,
  newWorldCard: HTMLDivElement,
  loadWorldCard: HTMLDivElement,
) => (next: SubState): void => {
  MutableRef.set(refs.subStateRef, next)
  rootCard.style.display = next === 'root' ? 'flex' : 'none'
  newWorldCard.style.display = next === 'new-world' ? 'flex' : 'none'
  loadWorldCard.style.display = next === 'load-world' ? 'flex' : 'none'
}

export const makeUpdateModeButton = (refs: MenuRefs, buttons: MenuButtons) => (): void => {
  const mode = MutableRef.get(refs.newWorldModeRef)
  buttons.nwMode.textContent = mode === 'survival' ? 'Survival' : 'Creative'
}

export const makeCompleteWith = (refs: MenuRefs) => (choice: MainMenuChoice): void => {
  const deferredOpt = MutableRef.get(refs.activeDeferredRef)
  MutableRef.set(refs.activeDeferredRef, Option.none())
  Option.map(deferredOpt, (deferred) => {
    Effect.runFork(Deferred.succeed(deferred, choice))
  })
}

// --- Load list ---

export const makeRefreshLoadList = (
  dom: DomOperationsService,
  storageService: StorageService,
  buttons: MenuButtons,
  completeWith: (choice: MainMenuChoice) => void,
  openDeleteConfirm: (worldId: WorldId, label: string) => void,
): (() => Effect.Effect<void, never>) =>
  () =>
    storageService.listWorldMetadata.pipe(
      Effect.matchEffect({
        onFailure: (err) =>
          Effect.logWarning(`MainMenu: listWorldMetadata failed: ${String(err)}`).pipe(
            Effect.andThen(
              Effect.sync(() => {
                dom.setInnerHTML(buttons.lwList, '<div style="opacity:0.7">Failed to load worlds</div>')
              }),
            ),
          ),
        onSuccess: ({ valid, corrupt }) =>
          Effect.sync(() => {
            if (valid.length === 0 && corrupt.length === 0) {
              dom.setInnerHTML(
                buttons.lwList,
                '<div style="opacity:0.7;padding:8px">No saved worlds yet</div>',
              )
              return
            }
            // Sort valid by lastPlayed desc.
            const lastPlayedDesc = Order.reverse(
              Order.mapInput(
                Order.number,
                (entry: { readonly worldId: WorldId; readonly metadata: WorldMetadata }) =>
                  entry.metadata.lastPlayed.getTime(),
              ),
            )
            const sorted = Arr.sort(valid, lastPlayedDesc)
            dom.setInnerHTML(buttons.lwList, '')
            Arr.forEach(sorted, ({ worldId, metadata }) => {
              renderValidRow(
                dom,
                buttons.lwList,
                worldId,
                metadata,
                () => completeWith({ action: 'loadWorld', worldId }),
                () => openDeleteConfirm(worldId, String(worldId)),
              )
            })
            Arr.forEach(corrupt, (worldId) => {
              renderCorruptRow(
                dom,
                buttons.lwList,
                worldId,
                () => openDeleteConfirm(worldId, `${String(worldId)} (corrupt)`),
              )
            })
          }),
      }),
    )

// --- Delete confirm ---

export const makeOpenDeleteConfirm = (
  storageService: StorageService,
  confirmDialog: ConfirmDialogService,
  refreshLoadList: () => Effect.Effect<void, never>,
) => (worldId: WorldId, label: string): void => {
  Effect.runFork(
    confirmDialog
      .show(`Delete '${label}'? This cannot be undone.`, 'Delete', 'Cancel')
      .pipe(
        Effect.flatMap((confirmed) =>
          confirmed
            ? storageService.deleteWorld(worldId).pipe(
                Effect.catchAllCause((cause) =>
                  Effect.logError(`MainMenu: deleteWorld failed: ${Cause.pretty(cause)}`),
                ),
                Effect.andThen(refreshLoadList()),
              )
            : Effect.void,
        ),
      ),
  )
}

// --- Click handlers ---

export interface ClickHandlers {
  readonly onNewWorldClick: () => void
  readonly onLoadWorldClick: () => void
  readonly onSettingsClick: () => void
  readonly onQuitClick: () => void
  readonly onNwModeClick: () => void
  readonly onNwCancelClick: () => void
  readonly onNwConfirmClick: () => void
  readonly onLwBackClick: () => void
  readonly onEsc: (ev: KeyboardEvent) => void
}

export const makeClickHandlers = (
  refs: MenuRefs,
  buttons: MenuButtons,
  setSubState: (next: SubState) => void,
  updateModeButton: () => void,
  completeWith: (choice: MainMenuChoice) => void,
  refreshLoadList: () => Effect.Effect<void, never>,
): ClickHandlers => ({
  onNewWorldClick: () => {
    MutableRef.set(refs.newWorldModeRef, 'survival')
    buttons.nwName.value = ''
    updateModeButton()
    setSubState('new-world')
    buttons.nwName.focus()
  },
  onLoadWorldClick: () => {
    setSubState('load-world')
    Effect.runFork(refreshLoadList())
  },
  onSettingsClick: () => {
    Option.map(MutableRef.get(refs.settingsHandlerRef), (handler) => handler())
  },
  onQuitClick: () => {
    completeWith({ action: 'quit' })
  },
  onNwModeClick: () => {
    MutableRef.set(refs.newWorldModeRef, cycleGameMode(MutableRef.get(refs.newWorldModeRef)))
    updateModeButton()
  },
  onNwCancelClick: () => {
    setSubState('root')
    buttons.newWorld.focus()
  },
  onNwConfirmClick: () => {
    const trimmed = buttons.nwName.value.trim()
    const worldId = trimmed.length > 0 ? WorldId.make(trimmed) : generateWorldId()
    const gameMode = MutableRef.get(refs.newWorldModeRef)
    completeWith({ action: 'newWorld', worldId, gameMode })
  },
  onLwBackClick: () => {
    setSubState('root')
    buttons.loadWorld.focus()
  },
  onEsc: (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return
    const sub = MutableRef.get(refs.subStateRef)
    if (sub === 'root') return
    ev.preventDefault()
    setSubState('root')
    const focusTarget = sub === 'new-world' ? buttons.newWorld : buttons.loadWorld
    focusTarget.focus()
  },
})
