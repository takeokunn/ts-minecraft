import { Cause, Effect, Ref } from 'effect'
import { SettingsService } from '@/application/settings/settings-service'
import { DomOperations } from '@/presentation/hud/crosshair'

export class SettingsOverlay extends Effect.Service<SettingsOverlay>()(
  '@minecraft/presentation/SettingsOverlay',
  {
    scoped: Effect.gen(function* () {
      const settingsService = yield* SettingsService
      const dom = yield* DomOperations

      let overlayEl: HTMLDivElement | null = null
      let renderDistanceInput: HTMLInputElement | null = null
      let sensitivityInput: HTMLInputElement | null = null
      let dayLengthInput: HTMLInputElement | null = null
      let applyBtn: HTMLButtonElement | null = null
      let closeBtn: HTMLButtonElement | null = null

      const isVisibleRef = yield* Ref.make(false)

      const createOverlay = (): void => {
        if (typeof document === 'undefined') return

        overlayEl = dom.createElement('div') as HTMLDivElement
        overlayEl.id = 'settings-overlay'
        overlayEl.style.cssText = [
          'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
          'background:rgba(0,0,0,0.85)', 'color:#fff', 'padding:24px',
          'border-radius:8px', 'min-width:300px', 'font-family:monospace',
          'z-index:1000', 'display:none',
        ].join(';')

        dom.setInnerHTML(overlayEl, `
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
          <div style="display:flex;gap:8px">
            <button id="settings-apply" style="flex:1;padding:8px;cursor:pointer;background:#4a7;border:none;color:#fff;border-radius:4px">Apply</button>
            <button id="settings-close" style="flex:1;padding:8px;cursor:pointer;background:#555;border:none;color:#fff;border-radius:4px">Close</button>
          </div>
        `)

        dom.appendChild(overlayEl)

        renderDistanceInput = dom.querySelector<HTMLInputElement>(overlayEl, '#rd-input')
        sensitivityInput = dom.querySelector<HTMLInputElement>(overlayEl, '#ms-input')
        dayLengthInput = dom.querySelector<HTMLInputElement>(overlayEl, '#dl-input')
        applyBtn = dom.querySelector<HTMLButtonElement>(overlayEl, '#settings-apply')
        closeBtn = dom.querySelector<HTMLButtonElement>(overlayEl, '#settings-close')
      }

      const applyEffect = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const rd = parseInt(renderDistanceInput?.value ?? '8', 10)
          const ms = parseFloat(sensitivityInput?.value ?? '0.5')
          const dl = parseInt(dayLengthInput?.value ?? '400', 10)
          yield* settingsService.updateSettings({ renderDistance: rd, mouseSensitivity: ms, dayLengthSeconds: dl })
        })

      function syncEffect(): Effect.Effect<void, never> {
        return Effect.gen(function* () {
          const settings = yield* settingsService.getSettings()
          if (renderDistanceInput) {
            renderDistanceInput.value = String(settings.renderDistance)
            const rdVal = overlayEl ? dom.querySelector(overlayEl, '#rd-val') : null
            if (rdVal) rdVal.textContent = String(settings.renderDistance)
          }
          if (sensitivityInput) {
            sensitivityInput.value = String(settings.mouseSensitivity)
            const msVal = overlayEl ? dom.querySelector(overlayEl, '#ms-val') : null
            if (msVal) msVal.textContent = String(settings.mouseSensitivity)
          }
          if (dayLengthInput) {
            dayLengthInput.value = String(settings.dayLengthSeconds)
            const dlVal = overlayEl ? dom.querySelector(overlayEl, '#dl-val') : null
            if (dlVal) dlVal.textContent = String(settings.dayLengthSeconds)
          }
        })
      }

      // Named event handler functions for proper cleanup via removeEventListener
      const handleRdInput = () => {
        const el = overlayEl ? dom.querySelector(overlayEl, '#rd-val') : null
        if (el && renderDistanceInput) el.textContent = renderDistanceInput.value
      }

      const handleMsInput = () => {
        const el = overlayEl ? dom.querySelector(overlayEl, '#ms-val') : null
        if (el && sensitivityInput) el.textContent = sensitivityInput.value
      }

      const handleDlInput = () => {
        const el = overlayEl ? dom.querySelector(overlayEl, '#dl-val') : null
        if (el && dayLengthInput) el.textContent = dayLengthInput.value
      }

      const handleApply = () => {
        Effect.runFork(
          applyEffect().pipe(
            Effect.catchAllCause(cause =>
              Effect.logError(`Settings apply error: ${Cause.pretty(cause)}`)
            )
          )
        )
      }

      const handleClose = () => {
        Effect.runFork(Ref.set(isVisibleRef, false).pipe(Effect.catchAllCause(() => Effect.void)))
        if (overlayEl) overlayEl.style.display = 'none'
      }

      createOverlay()

      yield* Effect.acquireRelease(
        Effect.sync(() => {
          renderDistanceInput?.addEventListener('input', handleRdInput)
          sensitivityInput?.addEventListener('input', handleMsInput)
          dayLengthInput?.addEventListener('input', handleDlInput)
          applyBtn?.addEventListener('click', handleApply)
          closeBtn?.addEventListener('click', handleClose)
        }),
        () => Effect.sync(() => {
          renderDistanceInput?.removeEventListener('input', handleRdInput)
          sensitivityInput?.removeEventListener('input', handleMsInput)
          dayLengthInput?.removeEventListener('input', handleDlInput)
          applyBtn?.removeEventListener('click', handleApply)
          closeBtn?.removeEventListener('click', handleClose)
          overlayEl?.remove()
        })
      )

      return {
        /**
         * Initialize the settings overlay DOM elements. Call once at startup.
         */
        initialize: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            // DOM elements are already created in the scoped initializer
          }),

        /**
         * Toggle the settings overlay visibility.
         * Returns true if now open, false if now closed.
         */
        toggle: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const current = yield* Ref.get(isVisibleRef)
            const next = !current
            yield* Ref.set(isVisibleRef, next)
            if (overlayEl) overlayEl.style.display = next ? 'block' : 'none'
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
        applyToSettings: (): Effect.Effect<void, never> => applyEffect(),
      }
    }),
  }
) {}
export const SettingsOverlayLive = SettingsOverlay.Default
