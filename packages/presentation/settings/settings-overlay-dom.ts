import { Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

export type SettingsOverlayDom = {
  readonly overlayEl: Option.Option<HTMLDivElement>
  readonly renderDistanceInput: Option.Option<HTMLInputElement>
  readonly adaptivePerformanceInput: Option.Option<HTMLInputElement>
  readonly sensitivityInput: Option.Option<HTMLInputElement>
  readonly dayLengthInput: Option.Option<HTMLInputElement>
  readonly audioEnabledInput: Option.Option<HTMLInputElement>
  readonly masterVolumeInput: Option.Option<HTMLInputElement>
  readonly sfxVolumeInput: Option.Option<HTMLInputElement>
  readonly musicVolumeInput: Option.Option<HTMLInputElement>
  readonly qualitySelect: Option.Option<HTMLSelectElement>
  readonly closeBtn: Option.Option<HTMLButtonElement>
  readonly gearBtn: Option.Option<HTMLButtonElement>
}

const panelCss = [
  'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
  'box-sizing:border-box',
  'width:min(420px,calc(100vw - 32px))',
  'max-height:calc(100vh - 48px)',
  'overflow:auto',
  'background:#7f7f7f',
  'background-image:linear-gradient(135deg,#9b9b9b 0%,#737373 52%,#565656 100%)',
  'color:#fff',
  'padding:18px',
  'border:4px solid #1d1d1d',
  'box-shadow:inset 3px 3px 0 #c9c9c9,inset -3px -3px 0 #353535,0 8px 0 rgba(0,0,0,0.28)',
  'font-family:"Minecraftia","Press Start 2P",monospace',
  'text-shadow:2px 2px 0 #2b2b2b',
  'z-index:5800',
  'display:none',
].join(';')

const labelBlockCss = 'display:block;margin-bottom:12px;font-size:13px;line-height:1.45'
const labelRowCss = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;cursor:pointer;font-size:13px;line-height:1.45'
const controlCss = [
  'display:block',
  'box-sizing:border-box',
  'width:100%',
  'margin-top:6px',
  'padding:7px 8px',
  'background:#2f2f2f',
  'color:#fff',
  'border:3px solid #111',
  'border-radius:0',
  'box-shadow:inset 2px 2px 0 #5a5a5a,inset -2px -2px 0 #161616',
  'font-family:monospace',
].join(';')
const rangeCss = 'display:block;width:100%;margin-top:6px;accent-color:#74b84a'
const closeButtonCss = [
  'flex:1',
  'padding:9px 12px',
  'cursor:pointer',
  'background:#6f6f6f',
  'color:#fff',
  'border:3px solid #111',
  'border-radius:0',
  'box-shadow:inset 2px 2px 0 #bcbcbc,inset -2px -2px 0 #353535',
  'font-family:"Minecraftia","Press Start 2P",monospace',
  'text-shadow:2px 2px 0 #222',
].join(';')

/* c8 ignore next 2 */
export const buildSettingsOverlayDom = (dom: DomOperationsService): SettingsOverlayDom => {
  if (typeof document === 'undefined') {
    return {
      overlayEl: Option.none<HTMLDivElement>(),
      renderDistanceInput: Option.none<HTMLInputElement>(),
      adaptivePerformanceInput: Option.none<HTMLInputElement>(),
      sensitivityInput: Option.none<HTMLInputElement>(),
      dayLengthInput: Option.none<HTMLInputElement>(),
      audioEnabledInput: Option.none<HTMLInputElement>(),
      masterVolumeInput: Option.none<HTMLInputElement>(),
      sfxVolumeInput: Option.none<HTMLInputElement>(),
      musicVolumeInput: Option.none<HTMLInputElement>(),
      qualitySelect: Option.none<HTMLSelectElement>(),
      closeBtn: Option.none<HTMLButtonElement>(),
      gearBtn: Option.none<HTMLButtonElement>(),
    }
  }
  /* c8 ignore start */

  const el = dom.createElement('div')
  el.id = 'settings-overlay'
  el.style.cssText = panelCss

  dom.setInnerHTML(el, `
    <h2 style="margin:0 0 16px;font-size:18px;text-align:center;font-weight:700">Options</h2>
    <label style="${labelBlockCss}">
      Graphics Quality:
      <select id="quality-select" style="${controlCss}">
        <option value="low">Low</option>
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
        <option value="ultra">Ultra</option>
      </select>
    </label>
    <label style="${labelRowCss}">
      <input id="adaptive-performance-input" type="checkbox" checked style="margin:0">
      <span>Adaptive performance mode</span>
    </label>
    <label style="${labelBlockCss}">
      Render Distance: <span id="rd-val">4</span>
      <input id="rd-input" type="range" min="2" max="16" step="1" value="4"
        style="${rangeCss}">
    </label>
    <label style="${labelBlockCss}">
      Mouse Sensitivity: <span id="ms-val">0.5</span>
      <input id="ms-input" type="range" min="0.1" max="3.0" step="0.1" value="0.5"
        style="${rangeCss}">
    </label>
    <label style="${labelBlockCss};margin-bottom:16px">
      Day Length (seconds): <span id="dl-val">400</span>
      <input id="dl-input" type="range" min="120" max="1200" step="60" value="400"
        style="${rangeCss}">
    </label>
    <hr style="border:0;border-top:3px solid #3f3f3f;border-bottom:3px solid #ababab;margin:16px 0">
    <h3 style="margin:0 0 8px;font-size:14px">Audio</h3>
    <label style="${labelRowCss};margin-bottom:8px">
      <input id="audio-enabled-input" type="checkbox" style="margin:0">
      <span>Audio Enabled</span>
    </label>
    <label style="${labelBlockCss};margin-bottom:8px">
      Master Volume: <span id="mv-val">1.0</span>
      <input id="mv-input" type="range" min="0" max="1" step="0.05" value="1"
        style="${rangeCss}">
    </label>
    <label style="${labelBlockCss};margin-bottom:8px">
      SFX Volume: <span id="sv-val">1.0</span>
      <input id="sv-input" type="range" min="0" max="1" step="0.05" value="1"
        style="${rangeCss}">
    </label>
    <label style="${labelBlockCss};margin-bottom:12px">
      Music Volume: <span id="muv-val">1.0</span>
      <input id="muv-input" type="range" min="0" max="1" step="0.05" value="1"
        style="${rangeCss}">
    </label>
    <div style="display:flex;gap:8px">
      <button id="settings-close" style="${closeButtonCss}">Done</button>
    </div>
  `)

  dom.appendChild(el)

  const btn = dom.createElement('button')
  btn.id = 'settings-gear-btn'
  btn.textContent = 'Options...'
  btn.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px',
    'background:#6f6f6f', 'color:#fff',
    'border:3px solid #111',
    'box-shadow:inset 2px 2px 0 #bcbcbc,inset -2px -2px 0 #353535,0 3px 0 rgba(0,0,0,0.3)',
    'font-size:13px',
    'line-height:1',
    'padding:8px 12px',
    'cursor:pointer',
    'border-radius:0',
    'z-index:5500',
    'font-family:"Minecraftia","Press Start 2P",monospace',
    'text-shadow:2px 2px 0 #222',
  ].join(';')
  dom.appendChild(btn)

  return {
    overlayEl: Option.some(el),
    adaptivePerformanceInput: dom.querySelector<HTMLInputElement>(el, '#adaptive-performance-input'),
    renderDistanceInput: dom.querySelector<HTMLInputElement>(el, '#rd-input'),
    sensitivityInput: dom.querySelector<HTMLInputElement>(el, '#ms-input'),
    dayLengthInput: dom.querySelector<HTMLInputElement>(el, '#dl-input'),
    audioEnabledInput: dom.querySelector<HTMLInputElement>(el, '#audio-enabled-input'),
    masterVolumeInput: dom.querySelector<HTMLInputElement>(el, '#mv-input'),
    sfxVolumeInput: dom.querySelector<HTMLInputElement>(el, '#sv-input'),
    musicVolumeInput: dom.querySelector<HTMLInputElement>(el, '#muv-input'),
    qualitySelect: dom.querySelector<HTMLSelectElement>(el, '#quality-select'),
    closeBtn: dom.querySelector<HTMLButtonElement>(el, '#settings-close'),
    gearBtn: Option.some(btn),
  }
  /* c8 ignore stop */
}
