import { Cause, Effect, Match, Option, Ref } from 'effect'
import { SettingsService } from '@/application/settings/settings-service'
import { DomOperationsService } from '@/presentation/hud/crosshair'

export class SettingsOverlayService extends Effect.Service<SettingsOverlayService>()(
  '@minecraft/presentation/SettingsOverlay',
  {
    scoped: Effect.all([
      SettingsService,
      DomOperationsService,
      Ref.make(false),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([settingsService, dom, isVisibleRef]) =>
        // Build DOM once — yields const bindings, eliminates mutable let declarations
        Effect.sync(() => {
        if (typeof document === 'undefined') {
          return {
            overlayEl: Option.none<HTMLDivElement>(),
            renderDistanceInput: Option.none<HTMLInputElement>(),
            sensitivityInput: Option.none<HTMLInputElement>(),
            dayLengthInput: Option.none<HTMLInputElement>(),
            qualitySelect: Option.none<HTMLSelectElement>(),
            closeBtn: Option.none<HTMLButtonElement>(),
            gearBtn: Option.none<HTMLButtonElement>(),
          }
        }

        const el = dom.createElement('div')
        el.id = 'settings-overlay'
        el.style.cssText = [
          'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
          'background:rgba(0,0,0,0.85)', 'color:#fff', 'padding:24px',
          'border-radius:8px', 'min-width:300px', 'font-family:monospace',
          'z-index:1000', 'display:none',
        ].join(';')

        dom.setInnerHTML(el, `
          <h2 style="margin:0 0 16px;font-size:18px">Settings</h2>
          <label style="display:block;margin-bottom:12px">
            Graphics Quality:
            <select id="quality-select" style="display:block;width:100%;margin-top:4px;padding:4px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;font-family:monospace">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high" selected>High</option>
              <option value="ultra">Ultra</option>
            </select>
          </label>
          <label style="display:block;margin-bottom:12px">
            Render Distance: <span id="rd-val">8</span>
            <input id="rd-input" type="range" min="2" max="16" step="1" value="8"
              style="display:block;width:100%;margin-top:4px">
          </label>
          <label style="display:block;margin-bottom:12px">
            Mouse Sensitivity: <span id="ms-val">0.5</span>
            <input id="ms-input" type="range" min="0.1" max="3.0" step="0.1" value="0.5"
              style="display:block;width:100%;margin-top:4px">
          </label>
          <label style="display:block;margin-bottom:16px">
            Day Length (seconds): <span id="dl-val">400</span>
            <input id="dl-input" type="range" min="120" max="1200" step="60" value="400"
              style="display:block;width:100%;margin-top:4px">
          </label>
          <div style="display:flex;gap:8px">
            <button id="settings-close" style="flex:1;padding:8px;cursor:pointer;background:#555;border:none;color:#fff;border-radius:4px">Close</button>
          </div>
        `)

        dom.appendChild(el)

        const btn = dom.createElement('button')
        btn.id = 'settings-gear-btn'
        btn.textContent = '\u2699'
        btn.style.cssText = [
          'position:fixed', 'top:10px', 'left:10px',
          'background:rgba(0,0,0,0.7)', 'color:white',
          'border:none', 'font-size:20px',
          'padding:5px 10px', 'cursor:pointer',
          'border-radius:4px', 'z-index:10',
        ].join(';')
        dom.appendChild(btn)

        return {
          overlayEl: Option.some(el),
          renderDistanceInput: dom.querySelector<HTMLInputElement>(el, '#rd-input'),
          sensitivityInput: dom.querySelector<HTMLInputElement>(el, '#ms-input'),
          dayLengthInput: dom.querySelector<HTMLInputElement>(el, '#dl-input'),
          qualitySelect: dom.querySelector<HTMLSelectElement>(el, '#quality-select'),
          closeBtn: dom.querySelector<HTMLButtonElement>(el, '#settings-close'),
          gearBtn: Option.some(btn),
        }
        }).pipe(
          Effect.flatMap(({ overlayEl, renderDistanceInput, sensitivityInput, dayLengthInput, qualitySelect, closeBtn, gearBtn }) => {
        const commitEffect = (): Effect.Effect<void, never> =>
        settingsService.updateSettings({
          renderDistance: Option.match(renderDistanceInput, { onNone: () => 8, onSome: (el) => parseInt(el.value, 10) }),
          mouseSensitivity: Option.match(sensitivityInput, { onNone: () => 0.5, onSome: (el) => parseFloat(el.value) }),
          dayLengthSeconds: Option.match(dayLengthInput, { onNone: () => 400, onSome: (el) => parseInt(el.value, 10) }),
          graphicsQuality: Option.match(qualitySelect, {
            onNone: () => 'high' as const,
            onSome: (el) => Match.value(el.value).pipe(
              Match.when('low', () => 'low' as const),
              Match.when('medium', () => 'medium' as const),
              Match.when('high', () => 'high' as const),
              Match.when('ultra', () => 'ultra' as const),
              Match.orElse(() => 'high' as const),
            ),
          }),
        })

      const runCommit = () => {
        Effect.runFork(
          commitEffect().pipe(
            Effect.catchAllCause(cause =>
              Effect.logError(`Settings apply error: ${Cause.pretty(cause)}`)
            )
          )
        )
      }

      function syncEffect(): Effect.Effect<void, never> {
        return settingsService.getSettings().pipe(
          Effect.flatMap((settings) => Effect.sync(() => {
            Option.match(renderDistanceInput, {
              onNone: () => {},
              onSome: (input) => {
                input.value = String(settings.renderDistance)
                Option.match(overlayEl, { onNone: () => {}, onSome: (el) => Option.match(dom.querySelector(el, '#rd-val'), { onNone: () => {}, onSome: (span) => { span.textContent = String(settings.renderDistance) } }) })
              },
            })
            Option.match(sensitivityInput, {
              onNone: () => {},
              onSome: (input) => {
                input.value = String(settings.mouseSensitivity)
                Option.match(overlayEl, { onNone: () => {}, onSome: (el) => Option.match(dom.querySelector(el, '#ms-val'), { onNone: () => {}, onSome: (span) => { span.textContent = String(settings.mouseSensitivity) } }) })
              },
            })
            Option.match(dayLengthInput, {
              onNone: () => {},
              onSome: (input) => {
                input.value = String(settings.dayLengthSeconds)
                Option.match(overlayEl, { onNone: () => {}, onSome: (el) => Option.match(dom.querySelector(el, '#dl-val'), { onNone: () => {}, onSome: (span) => { span.textContent = String(settings.dayLengthSeconds) } }) })
              },
            })
            Option.match(qualitySelect, { onNone: () => {}, onSome: (el) => { el.value = settings.graphicsQuality } })
          }))
        )
      }

      // Named event handler functions for proper cleanup via removeEventListener
      const handleRdInput = () => {
        Option.match(Option.all({ el: overlayEl, input: renderDistanceInput }), {
          onNone: () => {},
          onSome: ({ el, input }) => Option.match(dom.querySelector(el, '#rd-val'), { onNone: () => {}, onSome: (span) => { span.textContent = input.value } }),
        })
        runCommit()
      }

      const handleMsInput = () => {
        Option.match(Option.all({ el: overlayEl, input: sensitivityInput }), {
          onNone: () => {},
          onSome: ({ el, input }) => Option.match(dom.querySelector(el, '#ms-val'), { onNone: () => {}, onSome: (span) => { span.textContent = input.value } }),
        })
        runCommit()
      }

      const handleDlInput = () => {
        Option.match(Option.all({ el: overlayEl, input: dayLengthInput }), {
          onNone: () => {},
          onSome: ({ el, input }) => Option.match(dom.querySelector(el, '#dl-val'), { onNone: () => {}, onSome: (span) => { span.textContent = input.value } }),
        })
        runCommit()
      }

      const handleQualityChange = () => {
        runCommit()
      }

      const handleClose = () => {
        Effect.runFork(
          Ref.set(isVisibleRef, false).pipe(
            Effect.andThen(Effect.sync(() => {
              Option.match(overlayEl, { onNone: () => {}, onSome: (el) => { el.style.display = 'none' } })
            })),
            Effect.catchAllCause(() => Effect.void)
          )
        )
      }

      const handleGearClick = () => {
        Effect.runFork(
          Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current]).pipe(
            Effect.tap((next) => Effect.sync(() => {
              Option.match(overlayEl, { onNone: () => {}, onSome: (el) => { el.style.display = next ? 'block' : 'none' } })
            })),
            Effect.flatMap((next) => next ? syncEffect() : Effect.void),
            Effect.catchAllCause(() => Effect.void)
          )
        )
      }

        return Effect.acquireRelease(
          Effect.sync(() => {
            Option.match(renderDistanceInput, { onNone: () => {}, onSome: (el) => el.addEventListener('input', handleRdInput) })
            Option.match(sensitivityInput, { onNone: () => {}, onSome: (el) => el.addEventListener('input', handleMsInput) })
            Option.match(dayLengthInput, { onNone: () => {}, onSome: (el) => el.addEventListener('input', handleDlInput) })
            Option.match(qualitySelect, { onNone: () => {}, onSome: (el) => el.addEventListener('change', handleQualityChange) })
            Option.match(closeBtn, { onNone: () => {}, onSome: (el) => el.addEventListener('click', handleClose) })
            Option.match(gearBtn, { onNone: () => {}, onSome: (el) => el.addEventListener('click', handleGearClick) })
          }),
          () => Effect.sync(() => {
            Option.match(renderDistanceInput, { onNone: () => {}, onSome: (el) => el.removeEventListener('input', handleRdInput) })
            Option.match(sensitivityInput, { onNone: () => {}, onSome: (el) => el.removeEventListener('input', handleMsInput) })
            Option.match(dayLengthInput, { onNone: () => {}, onSome: (el) => el.removeEventListener('input', handleDlInput) })
            Option.match(qualitySelect, { onNone: () => {}, onSome: (el) => el.removeEventListener('change', handleQualityChange) })
            Option.match(closeBtn, { onNone: () => {}, onSome: (el) => el.removeEventListener('click', handleClose) })
            Option.match(gearBtn, { onNone: () => {}, onSome: (el) => { el.removeEventListener('click', handleGearClick); el.remove() } })
            Option.match(overlayEl, { onNone: () => {}, onSome: (el) => el.remove() })
          })
        ).pipe(Effect.as({
        /**
         * Toggle the settings overlay visibility.
         * Returns true if now open, false if now closed.
         */
        toggle: (): Effect.Effect<boolean, never> =>
          Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current]).pipe(
            Effect.tap((next) => Effect.sync(() => {
              Option.match(overlayEl, { onNone: () => {}, onSome: (el) => { el.style.display = next ? 'block' : 'none' } })
            })),
            Effect.tap((next) => next ? syncEffect() : Effect.void),
          ),

        /**
         * Check if the settings overlay is currently open.
         */
        isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

        /**
         * Sync the overlay inputs with the current settings values.
         */
        syncFromSettings: (): Effect.Effect<void, never> => syncEffect(),

        /**
         * Read the current input values and apply them to SettingsService.
         */
        applyToSettings: (): Effect.Effect<void, never> => commitEffect(),
        }))
      })
        )
      )
    ),
  }
) {}
export const SettingsOverlayLive = SettingsOverlayService.Default
