import { Array as Arr, Cause, Deferred, Effect, MutableRef, Option, Order } from 'effect'
import { StorageService, type WorldMetadata } from '@ts-minecraft/block-storage'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import { ConfirmDialogService } from '@ts-minecraft/app/presentation/menu/confirm-dialog'
import { WorldId } from '@ts-minecraft/kernel'
import type { GameMode } from '@ts-minecraft/game-mode'

/**
 * MainMenuService — top-level world selection menu (Phase 1, FR-1.1/1.9/1.11/1.12).
 *
 * Lifecycle:
 *   - DOM lives at boot scope (created once via Effect.acquireRelease in the
 *     scoped service body). The same overlay is shown/hidden across every
 *     trip through `mainMenuLoop` — re-creating DOM per visit would be
 *     wasteful and would defeat the "menu outlives sessions" invariant.
 *   - `show()` resets sub-state to ROOT, refreshes the world list, displays
 *     the overlay, and awaits a Deferred that the click handlers fulfill.
 *   - `hide()` removes the overlay from view (display:none); DOM stays mounted.
 *
 * Sub-states:
 *   - ROOT       — 4 buttons (New World / Load World / Settings / Quit)
 *   - NEW_WORLD  — name input + survival/creative cycler card + Confirm/Cancel
 *   - LOAD_WORLD — scrollable list of saved worlds + Back
 *
 * Keyboard nav:
 *   - Tab/Shift-Tab cycles focus through visible buttons (browser default).
 *   - Enter activates focused button (browser default — buttons are <button>).
 *   - Esc returns to ROOT (or no-op if already at ROOT — main menu has nowhere
 *     to "exit to" because there is no game running yet).
 *
 * Corrupt-row recovery: `listWorldMetadata` returns `{ valid, corrupt }`.
 * Corrupt rows render as a dedicated row with only a Delete button.
 */

export type MainMenuChoice =
  | { readonly action: 'newWorld'; readonly worldId: WorldId; readonly gameMode: GameMode }
  | { readonly action: 'loadWorld'; readonly worldId: WorldId }
  | { readonly action: 'quit' }

type SubState = 'root' | 'new-world' | 'load-world'

const overlayBaseStyle = [
  'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
  'background:rgba(20,20,30,0.92)',
  'color:#fff', 'font-family:monospace',
  'display:flex', 'align-items:center', 'justify-content:center', 'flex-direction:column',
  'z-index:5000',
].join(';')

const cardStyle = [
  'background:rgba(0,0,0,0.7)', 'padding:32px',
  'border-radius:8px', 'min-width:360px',
  'display:flex', 'flex-direction:column', 'gap:12px',
].join(';')

const buttonStyle = [
  'padding:12px 16px', 'cursor:pointer',
  'background:#3a3a4a', 'border:2px solid transparent', 'color:#fff',
  'border-radius:4px', 'font-family:monospace', 'font-size:16px',
].join(';')

const dangerButtonStyle = [
  'padding:8px 12px', 'cursor:pointer',
  'background:#a23030', 'border:2px solid transparent', 'color:#fff',
  'border-radius:4px', 'font-family:monospace', 'font-size:14px',
].join(';')

const inputStyle = [
  'padding:8px 12px', 'background:#222', 'color:#fff',
  'border:1px solid #555', 'border-radius:4px',
  'font-family:monospace', 'font-size:14px',
].join(';')

const formatLastPlayed = (date: Date): string => {
  try {
    return date.toLocaleString()
  } catch {
    return date.toISOString()
  }
}

const cycleGameMode = (mode: GameMode): GameMode => (mode === 'survival' ? 'creative' : 'survival')

const generateWorldId = (): WorldId =>
  WorldId.make(`world-${Date.now()}-${Math.floor(Math.random() * 10_000)}`)

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
            onSettings: (_handler: () => void): Effect.Effect<void, never> => Effect.void,
          })
        }

        return Effect.acquireRelease(
          Effect.sync(() => {
            // ---------- DOM build (mounted hidden) ----------
            const overlay = dom.createElement('div')
            overlay.id = 'main-menu-overlay'
            overlay.style.cssText = `${overlayBaseStyle};display:none`

            // ROOT card
            const rootCard = dom.createElement('div')
            rootCard.id = 'main-menu-root'
            rootCard.style.cssText = cardStyle
            dom.setInnerHTML(rootCard, `
              <h1 style="margin:0 0 16px;text-align:center;font-size:28px">ts-minecraft</h1>
              <button type="button" id="mm-new-world" style="${buttonStyle}">New World</button>
              <button type="button" id="mm-load-world" style="${buttonStyle}">Load World</button>
              <button type="button" id="mm-settings" style="${buttonStyle}">Settings</button>
              <button type="button" id="mm-quit" style="${buttonStyle}">Quit</button>
            `)

            // NEW_WORLD card
            const newWorldCard = dom.createElement('div')
            newWorldCard.id = 'main-menu-new-world'
            newWorldCard.style.cssText = `${cardStyle};display:none`
            dom.setInnerHTML(newWorldCard, `
              <h2 style="margin:0 0 8px;font-size:20px">Create New World</h2>
              <label style="display:flex;flex-direction:column;gap:4px">
                <span>World name</span>
                <input type="text" id="mm-nw-name" style="${inputStyle}" placeholder="My World" />
              </label>
              <label style="display:flex;flex-direction:column;gap:4px">
                <span>Game mode</span>
                <button type="button" id="mm-nw-mode" style="${buttonStyle}">Survival</button>
              </label>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button type="button" id="mm-nw-cancel" style="${buttonStyle};flex:1">Cancel</button>
                <button type="button" id="mm-nw-confirm" style="${buttonStyle};flex:1;background:#3a6a3a">Confirm</button>
              </div>
            `)

            // LOAD_WORLD card
            const loadWorldCard = dom.createElement('div')
            loadWorldCard.id = 'main-menu-load-world'
            loadWorldCard.style.cssText = `${cardStyle};min-width:480px;max-height:80vh;display:none;overflow:auto`
            dom.setInnerHTML(loadWorldCard, `
              <h2 style="margin:0 0 8px;font-size:20px">Load World</h2>
              <div id="mm-lw-list" style="display:flex;flex-direction:column;gap:8px;min-height:60px"></div>
              <div style="display:flex;gap:8px;margin-top:8px">
                <button type="button" id="mm-lw-back" style="${buttonStyle};flex:1">Back</button>
              </div>
            `)

            overlay.appendChild(rootCard)
            overlay.appendChild(newWorldCard)
            overlay.appendChild(loadWorldCard)
            dom.appendChild(overlay)

            const required = <T extends HTMLElement>(parent: HTMLElement, selector: string): T => {
              const found = dom.querySelector<T>(parent, selector)
              return Option.match(found, {
                onNone: () => {
                  throw new Error(`MainMenuService: missing required DOM element ${selector}`)
                },
                onSome: (el) => el,
              })
            }

            const buttons = {
              newWorld: required<HTMLButtonElement>(rootCard, '#mm-new-world'),
              loadWorld: required<HTMLButtonElement>(rootCard, '#mm-load-world'),
              settings: required<HTMLButtonElement>(rootCard, '#mm-settings'),
              quit: required<HTMLButtonElement>(rootCard, '#mm-quit'),
              nwName: required<HTMLInputElement>(newWorldCard, '#mm-nw-name'),
              nwMode: required<HTMLButtonElement>(newWorldCard, '#mm-nw-mode'),
              nwCancel: required<HTMLButtonElement>(newWorldCard, '#mm-nw-cancel'),
              nwConfirm: required<HTMLButtonElement>(newWorldCard, '#mm-nw-confirm'),
              lwList: required<HTMLDivElement>(loadWorldCard, '#mm-lw-list'),
              lwBack: required<HTMLButtonElement>(loadWorldCard, '#mm-lw-back'),
            }

            return {
              overlay,
              rootCard,
              newWorldCard,
              loadWorldCard,
              buttons,
            }
          }),
          ({ overlay }) =>
            Effect.sync(() => {
              dom.removeChild(overlay)
            }),
        ).pipe(
          Effect.flatMap(({ overlay, rootCard, newWorldCard, loadWorldCard, buttons }) => {
            // ---------- Mutable run-state for the active show() call ----------
            const subStateRef = MutableRef.make<SubState>('root')
            const newWorldModeRef = MutableRef.make<GameMode>('survival')
            const activeDeferredRef = MutableRef.make<Option.Option<Deferred.Deferred<MainMenuChoice, never>>>(Option.none())
            const settingsHandlerRef = MutableRef.make<Option.Option<() => void>>(Option.none())
            const escHandlerRef = MutableRef.make<Option.Option<(ev: KeyboardEvent) => void>>(Option.none())

            const setSubState = (next: SubState): void => {
              MutableRef.set(subStateRef, next)
              rootCard.style.display = next === 'root' ? 'flex' : 'none'
              newWorldCard.style.display = next === 'new-world' ? 'flex' : 'none'
              loadWorldCard.style.display = next === 'load-world' ? 'flex' : 'none'
            }

            const updateModeButton = (): void => {
              const mode = MutableRef.get(newWorldModeRef)
              buttons.nwMode.textContent = mode === 'survival' ? 'Survival' : 'Creative'
            }

            const completeWith = (choice: MainMenuChoice): void => {
              const deferredOpt = MutableRef.get(activeDeferredRef)
              MutableRef.set(activeDeferredRef, Option.none())
              Option.match(deferredOpt, {
                onNone: () => {},
                onSome: (deferred) => {
                  Effect.runFork(Deferred.succeed(deferred, choice))
                },
              })
            }

            const refreshLoadList = (): Effect.Effect<void, never> =>
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
                      // Build rows manually for click handler attachment.
                      dom.setInnerHTML(buttons.lwList, '')
                      Arr.forEach(sorted, ({ worldId, metadata }) => {
                        renderValidRow(worldId, metadata)
                      })
                      Arr.forEach(corrupt, (worldId) => {
                        renderCorruptRow(worldId)
                      })
                    }),
                }),
              )

            const rowBaseStyle = [
              'display:flex', 'align-items:center', 'gap:8px',
              'padding:8px 12px',
              'background:rgba(255,255,255,0.05)', 'border-radius:4px',
            ].join(';')

            const renderValidRow = (worldId: WorldId, metadata: WorldMetadata): void => {
              const row = dom.createElement('div')
              row.style.cssText = rowBaseStyle
              const info = dom.createElement('div')
              info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0'
              const name = dom.createElement('div')
              name.style.cssText = 'font-size:15px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
              name.textContent = String(worldId)
              const meta = dom.createElement('div')
              meta.style.cssText = 'font-size:12px;opacity:0.8'
              meta.textContent = `Last played: ${formatLastPlayed(metadata.lastPlayed)}`
              info.appendChild(name)
              info.appendChild(meta)
              const badge = dom.createElement('span')
              badge.style.cssText = [
                'padding:2px 8px', 'border-radius:12px', 'font-size:11px',
                metadata.gameMode === 'creative' ? 'background:#3a5a8a' : 'background:#3a6a3a',
              ].join(';')
              badge.textContent = metadata.gameMode === 'creative' ? 'Creative' : 'Survival'
              const loadBtn = dom.createElement('button')
              loadBtn.type = 'button'
              loadBtn.textContent = 'Load'
              loadBtn.style.cssText = buttonStyle
              loadBtn.addEventListener('click', () => {
                completeWith({ action: 'loadWorld', worldId })
              })
              const deleteBtn = dom.createElement('button')
              deleteBtn.type = 'button'
              deleteBtn.textContent = 'Delete'
              deleteBtn.style.cssText = dangerButtonStyle
              deleteBtn.addEventListener('click', () => {
                openDeleteConfirm(worldId, String(worldId))
              })
              row.appendChild(info)
              row.appendChild(badge)
              row.appendChild(loadBtn)
              row.appendChild(deleteBtn)
              dom.appendChildTo(buttons.lwList, row)
            }

            const renderCorruptRow = (worldId: WorldId): void => {
              const row = dom.createElement('div')
              row.style.cssText = `${rowBaseStyle};background:rgba(140,40,40,0.25)`
              const info = dom.createElement('div')
              info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0'
              const name = dom.createElement('div')
              name.style.cssText = 'font-size:15px;font-weight:bold;color:#f99'
              name.textContent = `Corrupt: ${String(worldId)}`
              const meta = dom.createElement('div')
              meta.style.cssText = 'font-size:12px;opacity:0.8'
              meta.textContent = 'This world failed to decode. Delete to recover.'
              info.appendChild(name)
              info.appendChild(meta)
              const deleteBtn = dom.createElement('button')
              deleteBtn.type = 'button'
              deleteBtn.textContent = 'Delete'
              deleteBtn.style.cssText = dangerButtonStyle
              deleteBtn.addEventListener('click', () => {
                openDeleteConfirm(worldId, `${String(worldId)} (corrupt)`)
              })
              row.appendChild(info)
              row.appendChild(deleteBtn)
              dom.appendChildTo(buttons.lwList, row)
            }

            const openDeleteConfirm = (worldId: WorldId, label: string): void => {
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

            // ---------- Persistent click handlers ----------
            const onNewWorldClick = (): void => {
              MutableRef.set(newWorldModeRef, 'survival')
              buttons.nwName.value = ''
              updateModeButton()
              setSubState('new-world')
              buttons.nwName.focus()
            }
            const onLoadWorldClick = (): void => {
              setSubState('load-world')
              Effect.runFork(refreshLoadList())
            }
            const onSettingsClick = (): void => {
              Option.match(MutableRef.get(settingsHandlerRef), {
                onNone: () => {},
                onSome: (handler) => handler(),
              })
            }
            const onQuitClick = (): void => {
              completeWith({ action: 'quit' })
            }
            const onNwModeClick = (): void => {
              MutableRef.set(newWorldModeRef, cycleGameMode(MutableRef.get(newWorldModeRef)))
              updateModeButton()
            }
            const onNwCancelClick = (): void => {
              setSubState('root')
              buttons.newWorld.focus()
            }
            const onNwConfirmClick = (): void => {
              const trimmed = buttons.nwName.value.trim()
              const worldId = trimmed.length > 0 ? WorldId.make(trimmed) : generateWorldId()
              const gameMode = MutableRef.get(newWorldModeRef)
              completeWith({ action: 'newWorld', worldId, gameMode })
            }
            const onLwBackClick = (): void => {
              setSubState('root')
              buttons.loadWorld.focus()
            }
            const onEsc = (ev: KeyboardEvent): void => {
              if (ev.key !== 'Escape') return
              const sub = MutableRef.get(subStateRef)
              if (sub === 'root') return
              ev.preventDefault()
              setSubState('root')
              const focusTarget = sub === 'new-world' ? buttons.newWorld : buttons.loadWorld
              focusTarget.focus()
            }

            return Effect.acquireRelease(
              Effect.sync(() => {
                buttons.newWorld.addEventListener('click', onNewWorldClick)
                buttons.loadWorld.addEventListener('click', onLoadWorldClick)
                buttons.settings.addEventListener('click', onSettingsClick)
                buttons.quit.addEventListener('click', onQuitClick)
                buttons.nwMode.addEventListener('click', onNwModeClick)
                buttons.nwCancel.addEventListener('click', onNwCancelClick)
                buttons.nwConfirm.addEventListener('click', onNwConfirmClick)
                buttons.lwBack.addEventListener('click', onLwBackClick)
              }),
              () =>
                Effect.sync(() => {
                  buttons.newWorld.removeEventListener('click', onNewWorldClick)
                  buttons.loadWorld.removeEventListener('click', onLoadWorldClick)
                  buttons.settings.removeEventListener('click', onSettingsClick)
                  buttons.quit.removeEventListener('click', onQuitClick)
                  buttons.nwMode.removeEventListener('click', onNwModeClick)
                  buttons.nwCancel.removeEventListener('click', onNwCancelClick)
                  buttons.nwConfirm.removeEventListener('click', onNwConfirmClick)
                  buttons.lwBack.removeEventListener('click', onLwBackClick)
                  Option.match(MutableRef.get(escHandlerRef), {
                    onNone: () => {},
                    onSome: (handler) => {
                      window.removeEventListener('keydown', handler)
                    },
                  })
                }),
            ).pipe(
              Effect.as({
                show: (): Effect.Effect<MainMenuChoice, never> =>
                  Effect.gen(function* () {
                    const deferred = yield* Deferred.make<MainMenuChoice, never>()
                    yield* Effect.sync(() => {
                      MutableRef.set(activeDeferredRef, Option.some(deferred))
                      setSubState('root')
                      overlay.style.display = 'flex'
                      // Attach Esc listener for the duration of the show.
                      Option.match(MutableRef.get(escHandlerRef), {
                        onNone: () => {},
                        onSome: (handler) => window.removeEventListener('keydown', handler),
                      })
                      MutableRef.set(escHandlerRef, Option.some(onEsc))
                      window.addEventListener('keydown', onEsc)
                      buttons.newWorld.focus()
                    })
                    return yield* Deferred.await(deferred)
                  }),
                hide: (): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    overlay.style.display = 'none'
                    Option.match(MutableRef.get(escHandlerRef), {
                      onNone: () => {},
                      onSome: (handler) => {
                        window.removeEventListener('keydown', handler)
                      },
                    })
                    MutableRef.set(escHandlerRef, Option.none())
                  }),
                /**
                 * Register a callback for the Settings button. The MainMenuService
                 * is layer-agnostic about the SettingsOverlayService (lives in
                 * presentation, but our scope cuts across boot/session lines —
                 * the caller wires it up after both services exist).
                 */
                onSettings: (handler: () => void): Effect.Effect<void, never> =>
                  Effect.sync(() => {
                    MutableRef.set(settingsHandlerRef, Option.some(handler))
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
