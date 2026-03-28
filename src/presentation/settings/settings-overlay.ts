import { Cause, Effect, Option, Ref } from 'effect'
import { SettingsService } from '@/application/settings/settings-service'
import { DomOperationsService } from '@/presentation/hud/crosshair'

export class SettingsOverlayService extends Effect.Service<SettingsOverlayService>()(
  '@minecraft/presentation/SettingsOverlay',
  {
    scoped: Effect.gen(function* () {
      const settingsService = yield* SettingsService
      const dom = yield* DomOperationsService

      const isVisibleRef = yield* Ref.make(false)

      // Build DOM once — yields const bindings, eliminates mutable let declarations
      const {
        overlayEl, renderDistanceInput, sensitivityInput, dayLengthInput,
        shadowsInput, ssaoInput, bloomInput, skyInput, ssrInput, dofInput,
        godRaysInput, smaaInput, closeBtn, gearBtn,
      } = yield* Effect.sync(() => {
        if (typeof document === 'undefined') {
          return {
            overlayEl: Option.none<HTMLDivElement>(),
            renderDistanceInput: Option.none<HTMLInputElement>(),
            sensitivityInput: Option.none<HTMLInputElement>(),
            dayLengthInput: Option.none<HTMLInputElement>(),
            shadowsInput: Option.none<HTMLInputElement>(),
            ssaoInput: Option.none<HTMLInputElement>(),
            bloomInput: Option.none<HTMLInputElement>(),
            skyInput: Option.none<HTMLInputElement>(),
            ssrInput: Option.none<HTMLInputElement>(),
            dofInput: Option.none<HTMLInputElement>(),
            godRaysInput: Option.none<HTMLInputElement>(),
            smaaInput: Option.none<HTMLInputElement>(),
            closeBtn: Option.none<HTMLButtonElement>(),
            gearBtn: Option.none<HTMLButtonElement>(),
          }
        }

        const el = dom.createElement('div') as HTMLDivElement
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
          <label style="display:block;margin-bottom:12px">
            <input id="shadows-input" type="checkbox" checked style="margin-right:6px">
            Shadows
          </label>
          <label style="display:block;margin-bottom:12px">
            <input id="ssao-input" type="checkbox" checked style="margin-right:6px">
            Ambient Occlusion (GTAO)
          </label>
          <label style="display:block;margin-bottom:12px">
            <input id="bloom-input" type="checkbox" checked style="margin-right:6px">
            Bloom (Glow Effects)
          </label>
          <label style="display:block;margin-bottom:12px">
            <input id="sky-input" type="checkbox" checked style="margin-right:6px">
            Physical Sky
          </label>
          <label style="display:block;margin-bottom:12px">
            <input id="ssr-input" type="checkbox" style="margin-right:6px">
            Water Reflections (SSR)
          </label>
          <label style="display:block;margin-bottom:12px">
            <input id="dof-input" type="checkbox" style="margin-right:6px">
            Depth of Field
          </label>
          <label style="display:block;margin-bottom:12px">
            <input id="god-rays-input" type="checkbox" style="margin-right:6px">
            God Rays (Light Shafts)
          </label>
          <label style="display:block;margin-bottom:16px">
            <input id="smaa-input" type="checkbox" checked style="margin-right:6px">
            Anti-aliasing (SMAA)
          </label>
          <div style="display:flex;gap:8px">
            <button id="settings-close" style="flex:1;padding:8px;cursor:pointer;background:#555;border:none;color:#fff;border-radius:4px">Close</button>
          </div>
        `)

        dom.appendChild(el)

        const btn = dom.createElement('button') as HTMLButtonElement
        btn.id = 'settings-gear-btn'
        btn.textContent = '⚙'
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
          shadowsInput: dom.querySelector<HTMLInputElement>(el, '#shadows-input'),
          ssaoInput: dom.querySelector<HTMLInputElement>(el, '#ssao-input'),
          bloomInput: dom.querySelector<HTMLInputElement>(el, '#bloom-input'),
          skyInput: dom.querySelector<HTMLInputElement>(el, '#sky-input'),
          ssrInput: dom.querySelector<HTMLInputElement>(el, '#ssr-input'),
          dofInput: dom.querySelector<HTMLInputElement>(el, '#dof-input'),
          godRaysInput: dom.querySelector<HTMLInputElement>(el, '#god-rays-input'),
          smaaInput: dom.querySelector<HTMLInputElement>(el, '#smaa-input'),
          closeBtn: dom.querySelector<HTMLButtonElement>(el, '#settings-close'),
          gearBtn: Option.some(btn),
        }
      })

      const commitEffect = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          yield* settingsService.updateSettings({
            renderDistance: Option.getOrElse(Option.map(renderDistanceInput, (el) => parseInt(el.value, 10)), () => 8),
            mouseSensitivity: Option.getOrElse(Option.map(sensitivityInput, (el) => parseFloat(el.value)), () => 0.5),
            dayLengthSeconds: Option.getOrElse(Option.map(dayLengthInput, (el) => parseInt(el.value, 10)), () => 400),
            shadowsEnabled: Option.getOrElse(Option.map(shadowsInput, (el) => el.checked), () => true),
            ssaoEnabled: Option.getOrElse(Option.map(ssaoInput, (el) => el.checked), () => true),
            bloomEnabled: Option.getOrElse(Option.map(bloomInput, (el) => el.checked), () => true),
            skyEnabled: Option.getOrElse(Option.map(skyInput, (el) => el.checked), () => true),
            ssrEnabled: Option.getOrElse(Option.map(ssrInput, (el) => el.checked), () => false),
            dofEnabled: Option.getOrElse(Option.map(dofInput, (el) => el.checked), () => false),
            godRaysEnabled: Option.getOrElse(Option.map(godRaysInput, (el) => el.checked), () => false),
            smaaEnabled: Option.getOrElse(Option.map(smaaInput, (el) => el.checked), () => true),
          })
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
        return Effect.gen(function* () {
          const settings = yield* settingsService.getSettings()
          yield* Effect.sync(() => {
            Option.map(renderDistanceInput, (input) => {
              input.value = String(settings.renderDistance)
              Option.flatMap(overlayEl, (el) => Option.map(dom.querySelector(el, '#rd-val'), (span) => { span.textContent = String(settings.renderDistance) }))
            })
            Option.map(sensitivityInput, (input) => {
              input.value = String(settings.mouseSensitivity)
              Option.flatMap(overlayEl, (el) => Option.map(dom.querySelector(el, '#ms-val'), (span) => { span.textContent = String(settings.mouseSensitivity) }))
            })
            Option.map(dayLengthInput, (input) => {
              input.value = String(settings.dayLengthSeconds)
              Option.flatMap(overlayEl, (el) => Option.map(dom.querySelector(el, '#dl-val'), (span) => { span.textContent = String(settings.dayLengthSeconds) }))
            })
            Option.map(shadowsInput, (el) => { el.checked = settings.shadowsEnabled })
            Option.map(ssaoInput, (el) => { el.checked = settings.ssaoEnabled })
            Option.map(bloomInput, (el) => { el.checked = settings.bloomEnabled })
            Option.map(skyInput, (el) => { el.checked = settings.skyEnabled })
            Option.map(ssrInput, (el) => { el.checked = settings.ssrEnabled })
            Option.map(dofInput, (el) => { el.checked = settings.dofEnabled })
            Option.map(godRaysInput, (el) => { el.checked = settings.godRaysEnabled })
            Option.map(smaaInput, (el) => { el.checked = settings.smaaEnabled })
          })
        })
      }

      // Named event handler functions for proper cleanup via removeEventListener
      const handleRdInput = () => {
        Option.map(Option.all({ el: overlayEl, input: renderDistanceInput }), ({ el, input }) =>
          Option.map(dom.querySelector(el, '#rd-val'), (span) => { span.textContent = input.value })
        )
        runCommit()
      }

      const handleMsInput = () => {
        Option.map(Option.all({ el: overlayEl, input: sensitivityInput }), ({ el, input }) =>
          Option.map(dom.querySelector(el, '#ms-val'), (span) => { span.textContent = input.value })
        )
        runCommit()
      }

      const handleDlInput = () => {
        Option.map(Option.all({ el: overlayEl, input: dayLengthInput }), ({ el, input }) =>
          Option.map(dom.querySelector(el, '#dl-val'), (span) => { span.textContent = input.value })
        )
        runCommit()
      }

      const handleToggleChange = () => {
        runCommit()
      }

      const handleClose = () => {
        Effect.runFork(
          Effect.gen(function* () {
            yield* Ref.set(isVisibleRef, false)
            Option.map(overlayEl, (el) => { el.style.display = 'none' })
          }).pipe(Effect.catchAllCause(() => Effect.void))
        )
      }

      const handleGearClick = () => {
        Effect.runFork(
          Effect.gen(function* () {
            const next = yield* Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current])
            Option.map(overlayEl, (el) => { el.style.display = next ? 'block' : 'none' })
            if (next) yield* syncEffect()
          }).pipe(Effect.catchAllCause(() => Effect.void))
        )
      }

      yield* Effect.acquireRelease(
        Effect.sync(() => {
          Option.map(renderDistanceInput, (el) => el.addEventListener('input', handleRdInput))
          Option.map(sensitivityInput, (el) => el.addEventListener('input', handleMsInput))
          Option.map(dayLengthInput, (el) => el.addEventListener('input', handleDlInput))
          Option.map(shadowsInput, (el) => el.addEventListener('change', handleToggleChange))
          Option.map(ssaoInput, (el) => el.addEventListener('change', handleToggleChange))
          Option.map(bloomInput, (el) => el.addEventListener('change', handleToggleChange))
          Option.map(skyInput, (el) => el.addEventListener('change', handleToggleChange))
          Option.map(ssrInput, (el) => el.addEventListener('change', handleToggleChange))
          Option.map(dofInput, (el) => el.addEventListener('change', handleToggleChange))
          Option.map(godRaysInput, (el) => el.addEventListener('change', handleToggleChange))
          Option.map(smaaInput, (el) => el.addEventListener('change', handleToggleChange))
          Option.map(closeBtn, (el) => el.addEventListener('click', handleClose))
          Option.map(gearBtn, (el) => el.addEventListener('click', handleGearClick))
        }),
        () => Effect.sync(() => {
          Option.map(renderDistanceInput, (el) => el.removeEventListener('input', handleRdInput))
          Option.map(sensitivityInput, (el) => el.removeEventListener('input', handleMsInput))
          Option.map(dayLengthInput, (el) => el.removeEventListener('input', handleDlInput))
          Option.map(shadowsInput, (el) => el.removeEventListener('change', handleToggleChange))
          Option.map(ssaoInput, (el) => el.removeEventListener('change', handleToggleChange))
          Option.map(bloomInput, (el) => el.removeEventListener('change', handleToggleChange))
          Option.map(skyInput, (el) => el.removeEventListener('change', handleToggleChange))
          Option.map(ssrInput, (el) => el.removeEventListener('change', handleToggleChange))
          Option.map(dofInput, (el) => el.removeEventListener('change', handleToggleChange))
          Option.map(godRaysInput, (el) => el.removeEventListener('change', handleToggleChange))
          Option.map(smaaInput, (el) => el.removeEventListener('change', handleToggleChange))
          Option.map(closeBtn, (el) => el.removeEventListener('click', handleClose))
          Option.map(gearBtn, (el) => { el.removeEventListener('click', handleGearClick); el.remove() })
          Option.map(overlayEl, (el) => el.remove())
        })
      )

      return {
        /**
         * Toggle the settings overlay visibility.
         * Returns true if now open, false if now closed.
         */
        toggle: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const next = yield* Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current])
            yield* Effect.sync(() => { Option.map(overlayEl, (el) => { el.style.display = next ? 'block' : 'none' }) })
            if (next) yield* syncEffect()
            return next
          }),

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
      }
    }),
  }
) {}
export const SettingsOverlayLive = SettingsOverlayService.Default
