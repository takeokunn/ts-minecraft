import { Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

export type SettingsOverlayDom = {
  readonly overlayEl: Option.Option<HTMLDivElement>
  readonly renderDistanceInput: Option.Option<HTMLInputElement>
  readonly adaptivePerformanceInput: Option.Option<HTMLInputElement>
  readonly sensitivityInput: Option.Option<HTMLInputElement>
  readonly dayLengthInput: Option.Option<HTMLInputElement>
  readonly qualitySelect: Option.Option<HTMLSelectElement>
  readonly closeBtn: Option.Option<HTMLButtonElement>
  readonly gearBtn: Option.Option<HTMLButtonElement>
}

/* c8 ignore next 2 */
export const buildSettingsOverlayDom = (dom: DomOperationsService): SettingsOverlayDom => {
  if (typeof document === 'undefined') {
    return {
      overlayEl: Option.none<HTMLDivElement>(),
      renderDistanceInput: Option.none<HTMLInputElement>(),
      adaptivePerformanceInput: Option.none<HTMLInputElement>(),
      sensitivityInput: Option.none<HTMLInputElement>(),
      dayLengthInput: Option.none<HTMLInputElement>(),
      qualitySelect: Option.none<HTMLSelectElement>(),
      closeBtn: Option.none<HTMLButtonElement>(),
      gearBtn: Option.none<HTMLButtonElement>(),
    }
  }
  /* c8 ignore start */

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
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
        <option value="ultra">Ultra</option>
      </select>
    </label>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer">
      <input id="adaptive-performance-input" type="checkbox" checked style="margin:0">
      <span>Adaptive performance mode</span>
    </label>
    <label style="display:block;margin-bottom:12px">
      Render Distance: <span id="rd-val">4</span>
      <input id="rd-input" type="range" min="2" max="16" step="1" value="4"
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
    adaptivePerformanceInput: dom.querySelector<HTMLInputElement>(el, '#adaptive-performance-input'),
    renderDistanceInput: dom.querySelector<HTMLInputElement>(el, '#rd-input'),
    sensitivityInput: dom.querySelector<HTMLInputElement>(el, '#ms-input'),
    dayLengthInput: dom.querySelector<HTMLInputElement>(el, '#dl-input'),
    qualitySelect: dom.querySelector<HTMLSelectElement>(el, '#quality-select'),
    closeBtn: dom.querySelector<HTMLButtonElement>(el, '#settings-close'),
    gearBtn: Option.some(btn),
  }
  /* c8 ignore stop */
}
