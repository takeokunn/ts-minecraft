import { Cause, Effect, Ref } from 'effect'
import { SettingsService } from '@/application/settings/settings-service'
import { DomOperationsService } from '@/presentation/hud/crosshair'

export class SettingsOverlayService extends Effect.Service<SettingsOverlayService>()(
  '@minecraft/presentation/SettingsOverlay',
  {
    scoped: Effect.gen(function* () {
      const settingsService = yield* SettingsService
      const dom = yield* DomOperationsService

      let overlayEl: HTMLDivElement | null = null
      let renderDistanceInput: HTMLInputElement | null = null
      let sensitivityInput: HTMLInputElement | null = null
      let dayLengthInput: HTMLInputElement | null = null
      let shadowsInput: HTMLInputElement | null = null
      let ssaoInput: HTMLInputElement | null = null
      let bloomInput: HTMLInputElement | null = null
      let skyInput: HTMLInputElement | null = null
      let ssrInput: HTMLInputElement | null = null
      let dofInput: HTMLInputElement | null = null
      let godRaysInput: HTMLInputElement | null = null
      let smaaInput: HTMLInputElement | null = null
      let applyBtn: HTMLButtonElement | null = null
      let closeBtn: HTMLButtonElement | null = null
      let gearBtn: HTMLButtonElement | null = null

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
            <button id="settings-apply" style="flex:1;padding:8px;cursor:pointer;background:#4a7;border:none;color:#fff;border-radius:4px">Apply</button>
            <button id="settings-close" style="flex:1;padding:8px;cursor:pointer;background:#555;border:none;color:#fff;border-radius:4px">Close</button>
          </div>
        `)

        dom.appendChild(overlayEl)

        gearBtn = dom.createElement('button') as HTMLButtonElement
        gearBtn.id = 'settings-gear-btn'
        gearBtn.textContent = '⚙'
        gearBtn.style.cssText = [
          'position:fixed', 'top:10px', 'left:10px',
          'background:rgba(0,0,0,0.7)', 'color:white',
          'border:none', 'font-size:20px',
          'padding:5px 10px', 'cursor:pointer',
          'border-radius:4px', 'z-index:10',
        ].join(';')
        dom.appendChild(gearBtn)

        renderDistanceInput = dom.querySelector<HTMLInputElement>(overlayEl, '#rd-input')
        sensitivityInput = dom.querySelector<HTMLInputElement>(overlayEl, '#ms-input')
        dayLengthInput = dom.querySelector<HTMLInputElement>(overlayEl, '#dl-input')
        shadowsInput = dom.querySelector<HTMLInputElement>(overlayEl, '#shadows-input')
        ssaoInput = dom.querySelector<HTMLInputElement>(overlayEl, '#ssao-input')
        bloomInput = dom.querySelector<HTMLInputElement>(overlayEl, '#bloom-input')
        skyInput = dom.querySelector<HTMLInputElement>(overlayEl, '#sky-input')
        ssrInput = dom.querySelector<HTMLInputElement>(overlayEl, '#ssr-input')
        dofInput = dom.querySelector<HTMLInputElement>(overlayEl, '#dof-input')
        godRaysInput = dom.querySelector<HTMLInputElement>(overlayEl, '#god-rays-input')
        smaaInput = dom.querySelector<HTMLInputElement>(overlayEl, '#smaa-input')
        applyBtn = dom.querySelector<HTMLButtonElement>(overlayEl, '#settings-apply')
        closeBtn = dom.querySelector<HTMLButtonElement>(overlayEl, '#settings-close')
      }

      const applyEffect = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const rd = parseInt(renderDistanceInput?.value ?? '8', 10)
          const ms = parseFloat(sensitivityInput?.value ?? '0.5')
          const dl = parseInt(dayLengthInput?.value ?? '400', 10)
          yield* settingsService.updateSettings({
            renderDistance: rd,
            mouseSensitivity: ms,
            dayLengthSeconds: dl,
            shadowsEnabled: shadowsInput?.checked ?? true,
            ssaoEnabled: ssaoInput?.checked ?? true,
            bloomEnabled: bloomInput?.checked ?? true,
            skyEnabled: skyInput?.checked ?? true,
            ssrEnabled: ssrInput?.checked ?? false,
            dofEnabled: dofInput?.checked ?? false,
            godRaysEnabled: godRaysInput?.checked ?? false,
            smaaEnabled: smaaInput?.checked ?? true,
          })
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
          if (shadowsInput) shadowsInput.checked = settings.shadowsEnabled
          if (ssaoInput) ssaoInput.checked = settings.ssaoEnabled
          if (bloomInput) bloomInput.checked = settings.bloomEnabled
          if (skyInput) skyInput.checked = settings.skyEnabled
          if (ssrInput) ssrInput.checked = settings.ssrEnabled
          if (dofInput) dofInput.checked = settings.dofEnabled
          if (godRaysInput) godRaysInput.checked = settings.godRaysEnabled
          if (smaaInput) smaaInput.checked = settings.smaaEnabled
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
        Effect.runFork(
          Effect.gen(function* () {
            yield* Ref.set(isVisibleRef, false)
            if (overlayEl) overlayEl.style.display = 'none'
          }).pipe(Effect.catchAllCause(() => Effect.void))
        )
      }

      const handleGearClick = () => {
        Effect.runFork(
          Effect.gen(function* () {
            const next = yield* Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current])
            if (overlayEl) overlayEl.style.display = next ? 'block' : 'none'
            if (next) yield* syncEffect()
          }).pipe(Effect.catchAllCause(() => Effect.void))
        )
      }

      createOverlay()

      yield* Effect.acquireRelease(
        Effect.sync(() => {
          renderDistanceInput?.addEventListener('input', handleRdInput)
          sensitivityInput?.addEventListener('input', handleMsInput)
          dayLengthInput?.addEventListener('input', handleDlInput)
          applyBtn?.addEventListener('click', handleApply)
          closeBtn?.addEventListener('click', handleClose)
          gearBtn?.addEventListener('click', handleGearClick)
        }),
        () => Effect.sync(() => {
          renderDistanceInput?.removeEventListener('input', handleRdInput)
          sensitivityInput?.removeEventListener('input', handleMsInput)
          dayLengthInput?.removeEventListener('input', handleDlInput)
          applyBtn?.removeEventListener('click', handleApply)
          closeBtn?.removeEventListener('click', handleClose)
          gearBtn?.removeEventListener('click', handleGearClick)
          gearBtn?.remove()
          overlayEl?.remove()
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
export const SettingsOverlayLive = SettingsOverlayService.Default
