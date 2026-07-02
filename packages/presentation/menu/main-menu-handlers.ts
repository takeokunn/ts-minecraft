import { Array as Arr, Cause, Deferred, Effect, MutableRef, Option, Order } from 'effect'
import { StorageService, parseWorldSeedInput, type WorldMetadata } from '@ts-minecraft/world'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { ConfirmDialogService } from '@ts-minecraft/presentation/menu/confirm-dialog'
import { WorldId } from '@ts-minecraft/core'
import type { GameMode } from '@ts-minecraft/game'
import type { MainMenuChoice } from './main-menu-types'
import type { SubState } from './main-menu-utils'
import { cycleGameMode, gameModeLabel, generateWorldId } from './main-menu-utils'
import type { MenuButtons } from './main-menu-dom'
import { renderValidRow, renderCorruptRow } from './main-menu-dom'

type RenamePrompt = (currentName: string) => string | null | undefined

// --- Menu run-state refs bundled together ---

export interface MenuRefs {
  readonly subStateRef: MutableRef.MutableRef<SubState>
  readonly newWorldModeRef: MutableRef.MutableRef<GameMode>
  readonly activeDeferredRef: MutableRef.MutableRef<Option.Option<Deferred.Deferred<MainMenuChoice, never>>>
  readonly escHandlerRef: MutableRef.MutableRef<Option.Option<(ev: KeyboardEvent) => void>>
  readonly recentWorldRef: MutableRef.MutableRef<Option.Option<WorldId>>
}

export const makeMenuRefs = (): MenuRefs => ({
  subStateRef: MutableRef.make<SubState>('root'),
  newWorldModeRef: MutableRef.make<GameMode>('survival'),
  activeDeferredRef: MutableRef.make<Option.Option<Deferred.Deferred<MainMenuChoice, never>>>(Option.none()),
  escHandlerRef: MutableRef.make<Option.Option<(ev: KeyboardEvent) => void>>(Option.none()),
  recentWorldRef: MutableRef.make<Option.Option<WorldId>>(Option.none()),
})

// --- State helpers ---

export const makeSetSubState = (
  refs: MenuRefs,
  rootCard: HTMLDivElement,
  newWorldCard: HTMLDivElement,
  loadWorldCard: HTMLDivElement,
  multiplayerCard: HTMLDivElement,
  howToPlayCard: HTMLDivElement,
) => (next: SubState): void => {
  MutableRef.set(refs.subStateRef, next)
  rootCard.style.display = next === 'root' ? 'flex' : 'none'
  newWorldCard.style.display = next === 'new-world' ? 'flex' : 'none'
  loadWorldCard.style.display = next === 'load-world' ? 'flex' : 'none'
  multiplayerCard.style.display = next === 'multiplayer' ? 'flex' : 'none'
  howToPlayCard.style.display = next === 'how-to-play' ? 'flex' : 'none'
}

export const makeUpdateModeButton = (refs: MenuRefs, buttons: MenuButtons) => (): void => {
  const mode = MutableRef.get(refs.newWorldModeRef)
  buttons.nwMode.textContent = gameModeLabel(mode)
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
  refs: MenuRefs,
  completeWith: (choice: MainMenuChoice) => void,
  openDeleteConfirm: (worldId: WorldId, label: string) => void,
  openRenamePrompt: (worldId: WorldId, label: string) => void,
): (() => Effect.Effect<void, never>) =>
  () =>
    storageService.listWorldMetadata.pipe(
      Effect.matchEffect({
        onFailure: (err) =>
          Effect.gen(function* () {
            yield* Effect.logWarning(`MainMenu: listWorldMetadata failed: ${String(err)}`)
            MutableRef.set(refs.recentWorldRef, Option.none())
            yield* Effect.sync(() => {
              dom.setInnerHTML(buttons.lwList, '<div style="opacity:0.7">Failed to load worlds</div>')
            })
          }),
        onSuccess: ({ valid, corrupt }) =>
          Effect.sync(() => {
            if (valid.length === 0 && corrupt.length === 0) {
              MutableRef.set(refs.recentWorldRef, Option.none())
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
            MutableRef.set(
              refs.recentWorldRef,
              Option.fromNullable(sorted.at(0)?.worldId),
            )
            dom.setInnerHTML(buttons.lwList, '')
            Arr.forEach(sorted, ({ worldId, metadata }) => {
              renderValidRow(
                dom,
                buttons.lwList,
                worldId,
                metadata,
                () => completeWith({ action: 'loadWorld', worldId }),
                () => openRenamePrompt(worldId, metadata.displayName ?? String(worldId)),
                () => openDeleteConfirm(worldId, metadata.displayName ?? String(worldId)),
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

// --- Rename prompt ---

const defaultRenamePrompt: RenamePrompt = (currentName) => globalThis.window?.prompt?.('Rename world', currentName)

export const makeOpenRenamePrompt = (
  storageService: StorageService,
  refreshLoadList: () => Effect.Effect<void, never>,
  promptForName: RenamePrompt = defaultRenamePrompt,
) => (worldId: WorldId, currentName: string): void => {
  Effect.runFork(
    Effect.gen(function* () {
      const requestedName = yield* Effect.sync(() => promptForName(currentName))
      const displayName = requestedName?.trim()

      if (!displayName || displayName === currentName) return

      const metadata = yield* storageService.loadWorldMetadata(worldId)
      if (Option.isNone(metadata)) {
        yield* Effect.logWarning(`MainMenu: cannot rename missing world "${String(worldId)}"`)
        return
      }

      yield* storageService.saveWorldMetadata(worldId, {
        ...metadata.value,
        displayName,
      })
      yield* refreshLoadList()
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.logError(`MainMenu: renameWorld failed for "${String(worldId)}": ${Cause.pretty(cause)}`),
      ),
    ),
  )
}

// --- Delete confirm ---

export const makeOpenDeleteConfirm = (
  storageService: StorageService,
  confirmDialog: ConfirmDialogService,
  refreshLoadList: () => Effect.Effect<void, never>,
) => (worldId: WorldId, label: string): void => {
  Effect.runFork(
    Effect.gen(function* () {
      const confirmed = yield* confirmDialog.show(`Delete '${label}'? This cannot be undone.`, 'Delete', 'Cancel')
      if (!confirmed) return
      yield* storageService.deleteWorld(worldId).pipe(
        Effect.catchAllCause((cause) =>
          Effect.logError(`MainMenu: deleteWorld failed: ${Cause.pretty(cause)}`),
        ),
      )
      yield* refreshLoadList()
    })
  )
}

// --- Click handlers ---

export interface ClickHandlers {
  readonly onNewWorldClick: () => void
  readonly onLoadWorldClick: () => void
  readonly onMultiplayerClick: () => void
  readonly onHowToPlayClick: () => void
  readonly onSettingsClick: () => void
  readonly onNwModeClick: () => void
  readonly onNwCancelClick: () => void
  readonly onNwConfirmClick: () => void
  readonly onLwBackClick: () => void
  readonly onMpCancelClick: () => void
  readonly onMpConfirmClick: () => void
  readonly onContinueWorldClick: () => void
  readonly onHowToPlayCloseClick: () => void
  readonly onEsc: (ev: KeyboardEvent) => void
}

export const makeClickHandlers = (
  refs: MenuRefs,
  buttons: MenuButtons,
  setSubState: (next: SubState) => void,
  updateModeButton: () => void,
  completeWith: (choice: MainMenuChoice) => void,
  openSettings: () => Effect.Effect<void, never>,
  refreshLoadList: () => Effect.Effect<void, never>,
): ClickHandlers => ({
  onNewWorldClick: () => {
    MutableRef.set(refs.newWorldModeRef, 'survival')
    buttons.nwName.value = ''
    buttons.nwSeed.value = ''
    updateModeButton()
    setSubState('new-world')
    buttons.nwName.focus()
  },
  onLoadWorldClick: () => {
    setSubState('load-world')
    Effect.runFork(refreshLoadList())
  },
  onMultiplayerClick: () => {
    setSubState('multiplayer')
    buttons.mpServerUrl.focus()
  },
  onContinueWorldClick: () => {
    const recentWorld = MutableRef.get(refs.recentWorldRef)
    if (Option.isSome(recentWorld)) {
      completeWith({ action: 'loadWorld', worldId: recentWorld.value })
      return
    }
    setSubState('load-world')
    Effect.runFork(refreshLoadList())
  },
  onHowToPlayClick: () => {
    setSubState('how-to-play')
    buttons.howToPlayClose.focus()
  },
  onSettingsClick: () => {
    Effect.runFork(
      openSettings().pipe(
        Effect.catchAllCause((cause) =>
          Effect.logError(`MainMenu: open settings failed: ${Cause.pretty(cause)}`),
        ),
      ),
    )
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
    const seed = parseWorldSeedInput(buttons.nwSeed.value)
    completeWith({
      action: 'newWorld',
      worldId,
      gameMode,
      ...(seed === undefined ? {} : { seed }),
    })
  },
  onLwBackClick: () => {
    setSubState('root')
    buttons.loadWorld.focus()
  },
  onMpCancelClick: () => {
    setSubState('root')
    buttons.multiplayer.focus()
  },
  onMpConfirmClick: () => {
    completeWith({
      action: 'multiplayer',
      serverUrl: buttons.mpServerUrl.value.trim(),
      playerName: buttons.mpPlayerName.value.trim(),
    })
  },
  onHowToPlayCloseClick: () => {
    setSubState('root')
    buttons.howToPlay.focus()
  },
  onEsc: (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return
    const sub = MutableRef.get(refs.subStateRef)
    if (sub === 'root') return
      ev.preventDefault()
      setSubState('root')
      const focusTarget =
        sub === 'new-world'
          ? buttons.newWorld
          : sub === 'load-world'
            ? buttons.loadWorld
            : sub === 'multiplayer'
              ? buttons.multiplayer
              : buttons.howToPlay
      focusTarget.focus()
    },
  })
