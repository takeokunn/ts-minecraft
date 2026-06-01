import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Deferred, Effect, MutableRef, Option } from 'effect'
import { WorldId } from '@ts-minecraft/core'
import { StorageError, StorageService, type WorldMetadata } from '@ts-minecraft/world'
import { DomOperationsService } from '../hud/crosshair'
import { ConfirmDialogService } from './confirm-dialog'
import {
  makeClickHandlers,
  makeCompleteWith,
  makeMenuRefs,
  makeOpenDeleteConfirm,
  makeRefreshLoadList,
  makeSetSubState,
  makeUpdateModeButton,
} from './main-menu-handlers'
import type { MenuButtons } from './main-menu-dom'
import type { MainMenuChoice } from './main-menu'
import type { SubState } from './main-menu-utils'

type FocusableButton = HTMLButtonElement & { readonly focus: ReturnType<typeof vi.fn> }
type FocusableInput = HTMLInputElement & { readonly focus: ReturnType<typeof vi.fn> }

const makeButton = (id: string): FocusableButton => ({
  id,
  style: { cssText: '', display: '' },
  textContent: '',
  value: '',
  focus: vi.fn(),
} as unknown as FocusableButton)

const makeInput = (id: string): FocusableInput => ({
  id,
  style: { cssText: '', display: '' },
  textContent: '',
  value: '',
  focus: vi.fn(),
} as unknown as FocusableInput)

const makeDiv = (id: string): HTMLDivElement => ({
  id,
  style: { cssText: '', display: '' },
  textContent: '',
} as unknown as HTMLDivElement)

const makeButtons = (): MenuButtons => ({
  newWorld: makeButton('new-world'),
  loadWorld: makeButton('load-world'),
  nwName: makeInput('nw-name'),
  nwMode: makeButton('nw-mode'),
  nwCancel: makeButton('nw-cancel'),
  nwConfirm: makeButton('nw-confirm'),
  lwList: makeDiv('lw-list'),
  lwBack: makeButton('lw-back'),
})

const makeDom = () => {
  const createdRows: HTMLElement[] = []
  const setInnerHTML = vi.fn((element: HTMLElement, html: string) => {
    element.innerHTML = html
  })
  const appendChildTo = vi.fn((_parent: HTMLElement, child: HTMLElement) => {
    createdRows.push(child)
  })
  return {
    createdRows,
    setInnerHTML,
    appendChildTo,
    service: DomOperationsService.of({
      _tag: '@minecraft/presentation/DomOperations' as const,
      createElement: <K extends keyof HTMLElementTagNameMap>(_tagName: K): HTMLElementTagNameMap[K] => ({
        style: { cssText: '', display: '' },
        dataset: {},
        textContent: '',
        type: '',
        addEventListener: vi.fn(),
        appendChild: vi.fn(),
      } as unknown as HTMLElementTagNameMap[K]),
      appendChild: vi.fn(),
      appendChildTo,
      removeChild: vi.fn(),
      getParentNode: () => Option.none(),
      setInnerHTML,
      querySelector: () => Option.none(),
    }),
  }
}

const makeMetadata = (lastPlayed: Date): WorldMetadata => ({
  seed: 1,
  createdAt: new Date('2026-05-01T12:00:00.000Z'),
  lastPlayed,
  playerSpawn: { x: 0, y: 64, z: 0 },
  gameMode: 'survival',
  saveVersion: 1,
})

const makeStorage = (overrides: Partial<StorageService> = {}): StorageService => StorageService.of({
  _tag: '@minecraft/infrastructure/storage/StorageService' as const,
  initialize: Effect.void,
  saveChunk: () => Effect.void,
  loadChunk: () => Effect.succeed(Option.none()),
  saveWorldMetadata: () => Effect.void,
  loadWorldMetadata: () => Effect.succeed(Option.none()),
  deleteWorld: () => Effect.void,
  listWorldMetadata: Effect.succeed({ valid: [], corrupt: [] }),
  ...overrides,
})

const delayForFork = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('presentation/menu/main-menu-handlers', () => {
  it('creates menu refs with root/survival defaults and no active handlers', () => {
    const refs = makeMenuRefs()

    expect(MutableRef.get(refs.subStateRef)).toBe('root')
    expect(MutableRef.get(refs.newWorldModeRef)).toBe('survival')
    expect(Option.isNone(MutableRef.get(refs.activeDeferredRef))).toBe(true)
    expect(Option.isNone(MutableRef.get(refs.escHandlerRef))).toBe(true)
  })

  it('toggles visible cards when sub-state changes', () => {
    const refs = makeMenuRefs()
    const rootCard = makeDiv('root')
    const newWorldCard = makeDiv('new-world')
    const loadWorldCard = makeDiv('load-world')
    const setSubState = makeSetSubState(refs, rootCard, newWorldCard, loadWorldCard)

    setSubState('new-world')

    expect(MutableRef.get(refs.subStateRef)).toBe('new-world')
    expect(rootCard.style.display).toBe('none')
    expect(newWorldCard.style.display).toBe('flex')
    expect(loadWorldCard.style.display).toBe('none')

    setSubState('load-world')

    expect(rootCard.style.display).toBe('none')
    expect(newWorldCard.style.display).toBe('none')
    expect(loadWorldCard.style.display).toBe('flex')

    setSubState('root')

    expect(rootCard.style.display).toBe('flex')
    expect(newWorldCard.style.display).toBe('none')
    expect(loadWorldCard.style.display).toBe('none')
  })

  it('updates the mode button text from the current mode ref', () => {
    const refs = makeMenuRefs()
    const buttons = makeButtons()
    const updateModeButton = makeUpdateModeButton(refs, buttons)

    updateModeButton()
    expect(buttons.nwMode.textContent).toBe('Survival')

    MutableRef.set(refs.newWorldModeRef, 'creative')
    updateModeButton()
    expect(buttons.nwMode.textContent).toBe('Creative')
  })

  it('resolves and clears the active deferred when completing with a choice', async () => {
    await Effect.runPromise(Effect.gen(function* () {
      const refs = makeMenuRefs()
      const deferred = yield* Deferred.make<MainMenuChoice, never>()
      const choice: MainMenuChoice = { action: 'loadWorld', worldId: WorldId.make('saved-world') }
      MutableRef.set(refs.activeDeferredRef, Option.some(deferred))

      makeCompleteWith(refs)(choice)

      const result = yield* Deferred.await(deferred)
      expect(result).toEqual(choice)
      expect(Option.isNone(MutableRef.get(refs.activeDeferredRef))).toBe(true)
    }))
  })

  it('refreshes the load list with an empty saved-world message', async () => {
    const dom = makeDom()
    const buttons = makeButtons()
    const refresh = makeRefreshLoadList(dom.service, makeStorage(), buttons, vi.fn(), vi.fn())

    await Effect.runPromise(refresh())

    expect(dom.setInnerHTML).toHaveBeenCalledWith(
      buttons.lwList,
      '<div style="opacity:0.7;padding:8px">No saved worlds yet</div>',
    )
  })

  it('refreshes the load list with a failure message when storage listing fails', async () => {
    const dom = makeDom()
    const buttons = makeButtons()
    const storage = makeStorage({
      listWorldMetadata: Effect.fail(new StorageError({ operation: 'listWorldMetadata', cause: 'boom' })),
    })
    const refresh = makeRefreshLoadList(dom.service, storage, buttons, vi.fn(), vi.fn())

    await Effect.runPromise(refresh())

    expect(dom.setInnerHTML).toHaveBeenCalledWith(
      buttons.lwList,
      '<div style="opacity:0.7">Failed to load worlds</div>',
    )
  })

  it('refreshes the load list with valid and corrupt row callbacks', async () => {
    const dom = makeDom()
    const buttons = makeButtons()
    const loadedChoices: MainMenuChoice[] = []
    const deleteRequests: Array<{ readonly worldId: WorldId; readonly label: string }> = []
    const newerWorldId = WorldId.make('newer')
    const olderWorldId = WorldId.make('older')
    const corruptWorldId = WorldId.make('corrupt')
    const storage = makeStorage({
      listWorldMetadata: Effect.succeed({
        valid: [
          { worldId: olderWorldId, metadata: makeMetadata(new Date('2026-05-01T00:00:00.000Z')) },
          { worldId: newerWorldId, metadata: makeMetadata(new Date('2026-05-03T00:00:00.000Z')) },
        ],
        corrupt: [corruptWorldId],
      }),
    })
    const refresh = makeRefreshLoadList(
      dom.service,
      storage,
      buttons,
      (choice) => loadedChoices.push(choice),
      (worldId, label) => deleteRequests.push({ worldId, label }),
    )

    await Effect.runPromise(refresh())

    expect(dom.setInnerHTML).toHaveBeenCalledWith(buttons.lwList, '')
    expect(dom.createdRows).toHaveLength(3)
  })

  it('creates a generated world id when confirming with a blank world name', () => {
    const refs = makeMenuRefs()
    const buttons = makeButtons()
    const choices: MainMenuChoice[] = []
    const handlers = makeClickHandlers(
      refs,
      buttons,
      vi.fn(),
      vi.fn(),
      (choice) => choices.push(choice),
      vi.fn(() => Effect.void),
    )

    buttons.nwName.value = '   '
    handlers.onNwConfirmClick()

    expect(choices.at(0)).toMatchObject({ action: 'newWorld', gameMode: 'survival' })
  })

  it('deletes and refreshes after delete confirmation is accepted', async () => {
    const worldId = WorldId.make('delete-me')
    const deleteWorld = vi.fn(() => Effect.void)
    const refreshLoadList = vi.fn(() => Effect.void)
    const confirmDialog = ConfirmDialogService.of({
      _tag: '@minecraft/presentation/ConfirmDialog' as const,
      show: vi.fn(() => Effect.succeed(true)),
    })
    const openDeleteConfirm = makeOpenDeleteConfirm(makeStorage({ deleteWorld }), confirmDialog, refreshLoadList)

    openDeleteConfirm(worldId, 'Delete Me')
    await delayForFork()

    expect(deleteWorld).toHaveBeenCalledWith(worldId)
    expect(refreshLoadList).toHaveBeenCalledTimes(1)
  })

  it('refreshes the load list even when confirmed delete fails', async () => {
    const worldId = WorldId.make('delete-fails')
    const deleteWorld = vi.fn(() => Effect.fail(new StorageError({ operation: 'deleteWorld', cause: 'boom' })))
    const refreshLoadList = vi.fn(() => Effect.void)
    const confirmDialog = ConfirmDialogService.of({
      _tag: '@minecraft/presentation/ConfirmDialog' as const,
      show: vi.fn(() => Effect.succeed(true)),
    })
    const openDeleteConfirm = makeOpenDeleteConfirm(makeStorage({ deleteWorld }), confirmDialog, refreshLoadList)

    openDeleteConfirm(worldId, 'Delete Fails')
    await delayForFork()

    expect(deleteWorld).toHaveBeenCalledWith(worldId)
    expect(refreshLoadList).toHaveBeenCalledTimes(1)
  })

  it('does not delete or refresh when delete confirmation is cancelled', async () => {
    const deleteWorld = vi.fn(() => Effect.void)
    const refreshLoadList = vi.fn(() => Effect.void)
    const confirmDialog = ConfirmDialogService.of({
      _tag: '@minecraft/presentation/ConfirmDialog' as const,
      show: vi.fn(() => Effect.succeed(false)),
    })
    const openDeleteConfirm = makeOpenDeleteConfirm(makeStorage({ deleteWorld }), confirmDialog, refreshLoadList)

    openDeleteConfirm(WorldId.make('keep-me'), 'Keep Me')
    await delayForFork()

    expect(deleteWorld).not.toHaveBeenCalled()
    expect(refreshLoadList).not.toHaveBeenCalled()
  })

  it('exposes click handlers for menu state, completion, refresh, and escape behavior', async () => {
    const refs = makeMenuRefs()
    const buttons = makeButtons()
    const subStates: SubState[] = []
    const choices: MainMenuChoice[] = []
    const updateModeButton = vi.fn()
    const refreshLoadList = vi.fn(() => Effect.void)
    const handlers = makeClickHandlers(
      refs,
      buttons,
      (next) => subStates.push(next),
      updateModeButton,
      (choice) => choices.push(choice),
      refreshLoadList,
    )

    buttons.nwName.value = 'stale'
    MutableRef.set(refs.newWorldModeRef, 'creative')
    handlers.onNewWorldClick()
    expect(MutableRef.get(refs.newWorldModeRef)).toBe('survival')
    expect(buttons.nwName.value).toBe('')
    expect(updateModeButton).toHaveBeenCalledTimes(1)
    expect(subStates).toContain('new-world')
    expect(buttons.nwName.focus).toHaveBeenCalledTimes(1)

    handlers.onNwModeClick()
    expect(MutableRef.get(refs.newWorldModeRef)).toBe('creative')

    buttons.nwName.value = ' Named World '
    handlers.onNwConfirmClick()
    expect(choices).toContainEqual({ action: 'newWorld', worldId: WorldId.make('Named World'), gameMode: 'creative' })

    handlers.onLoadWorldClick()
    await delayForFork()
    expect(subStates).toContain('load-world')
    expect(refreshLoadList).toHaveBeenCalledTimes(1)

    handlers.onNwCancelClick()
    expect(buttons.newWorld.focus).toHaveBeenCalledTimes(1)

    handlers.onLwBackClick()
    expect(buttons.loadWorld.focus).toHaveBeenCalledTimes(1)

    const preventDefault = vi.fn()
    MutableRef.set(refs.subStateRef, 'load-world')
    handlers.onEsc({ key: 'Escape', preventDefault } as unknown as KeyboardEvent)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(subStates.at(-1)).toBe('root')
  })

  it('ignores non-Escape keys and focuses the new-world button when escaping that card', () => {
    const refs = makeMenuRefs()
    const buttons = makeButtons()
    const subStates: SubState[] = []
    const handlers = makeClickHandlers(
      refs,
      buttons,
      (next) => subStates.push(next),
      vi.fn(),
      vi.fn(),
      vi.fn(() => Effect.void),
    )
    const preventDefault = vi.fn()

    handlers.onEsc({ key: 'Enter', preventDefault } as unknown as KeyboardEvent)
    MutableRef.set(refs.subStateRef, 'root')
    handlers.onEsc({ key: 'Escape', preventDefault } as unknown as KeyboardEvent)
    expect(preventDefault).not.toHaveBeenCalled()

    MutableRef.set(refs.subStateRef, 'new-world')
    handlers.onEsc({ key: 'Escape', preventDefault } as unknown as KeyboardEvent)

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(subStates.at(-1)).toBe('root')
    expect(buttons.newWorld.focus).toHaveBeenCalledTimes(1)
  })
})
