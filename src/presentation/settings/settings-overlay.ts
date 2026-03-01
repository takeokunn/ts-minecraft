import { Effect, Layer } from 'effect'
import { SettingsService } from '@/application/settings/settings-service'

export class SettingsOverlay extends Effect.Service<SettingsOverlay>()(
  '@minecraft/presentation/SettingsOverlay',
  {
    effect: Effect.gen(function* () {
      const settingsService = yield* SettingsService

      let overlayEl: HTMLDivElement | null = null
      let renderDistanceInput: HTMLInputElement | null = null
      let sensitivityInput: HTMLInputElement | null = null
      let dayLengthInput: HTMLInputElement | null = null
      let isVisible = false

      const createOverlay = (): void => {
        if (typeof document === 'undefined') return

        overlayEl = document.createElement('div')
        overlayEl.id = 'settings-overlay'
        overlayEl.style.cssText = [
          'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
          'background:rgba(0,0,0,0.85)', 'color:#fff', 'padding:24px',
          'border-radius:8px', 'min-width:300px', 'font-family:monospace',
          'z-index:1000', 'display:none',
        ].join(';')

        overlayEl.innerHTML = `
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
        `

        document.body.appendChild(overlayEl)

        renderDistanceInput = overlayEl.querySelector('#rd-input')
        sensitivityInput = overlayEl.querySelector('#ms-input')
        dayLengthInput = overlayEl.querySelector('#dl-input')

        // Live-update labels
        renderDistanceInput?.addEventListener('input', () => {
          const el = overlayEl?.querySelector('#rd-val')
          if (el && renderDistanceInput) el.textContent = renderDistanceInput.value
        })
        sensitivityInput?.addEventListener('input', () => {
          const el = overlayEl?.querySelector('#ms-val')
          if (el && sensitivityInput) el.textContent = sensitivityInput.value
        })
        dayLengthInput?.addEventListener('input', () => {
          const el = overlayEl?.querySelector('#dl-val')
          if (el && dayLengthInput) el.textContent = dayLengthInput.value
        })

        overlayEl.querySelector('#settings-apply')?.addEventListener('click', () => {
          Effect.runSync(applyEffect())
        })
        overlayEl.querySelector('#settings-close')?.addEventListener('click', () => {
          isVisible = false
          if (overlayEl) overlayEl.style.display = 'none'
        })
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
            const rdVal = overlayEl?.querySelector('#rd-val')
            if (rdVal) rdVal.textContent = String(settings.renderDistance)
          }
          if (sensitivityInput) {
            sensitivityInput.value = String(settings.mouseSensitivity)
            const msVal = overlayEl?.querySelector('#ms-val')
            if (msVal) msVal.textContent = String(settings.mouseSensitivity)
          }
          if (dayLengthInput) {
            dayLengthInput.value = String(settings.dayLengthSeconds)
            const dlVal = overlayEl?.querySelector('#dl-val')
            if (dlVal) dlVal.textContent = String(settings.dayLengthSeconds)
          }
        })
      }

      return {
        /**
         * Initialize the settings overlay DOM elements. Call once at startup.
         */
        initialize: (): Effect.Effect<void, never> =>
          Effect.sync(() => {
            createOverlay()
          }),

        /**
         * Toggle the settings overlay visibility.
         * Returns true if now open, false if now closed.
         */
        toggle: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            isVisible = !isVisible
            if (overlayEl) overlayEl.style.display = isVisible ? 'block' : 'none'
            if (isVisible) yield* syncEffect()
            return isVisible
          }),

        /**
         * Check if the settings overlay is currently open.
         */
        isOpen: (): Effect.Effect<boolean, never> => Effect.sync(() => isVisible),

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
export { SettingsOverlay as SettingsOverlayLive }
