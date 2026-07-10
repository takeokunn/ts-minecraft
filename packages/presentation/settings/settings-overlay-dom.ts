import { Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

export type SettingsOverlayDom = {
  readonly overlayEl: Option.Option<HTMLDivElement>
  readonly renderDistanceInput: Option.Option<HTMLInputElement>
  readonly adaptivePerformanceInput: Option.Option<HTMLInputElement>
  readonly difficultySelect: Option.Option<HTMLSelectElement>
  readonly reducedMotionInput: Option.Option<HTMLInputElement>
  readonly uiScaleInput: Option.Option<HTMLInputElement>
  readonly colorVisionSelect: Option.Option<HTMLSelectElement>
  readonly keyBindingsContainer: Option.Option<HTMLDivElement>
  readonly sensitivityInput: Option.Option<HTMLInputElement>
  readonly fovInput: Option.Option<HTMLInputElement>
  readonly dayLengthInput: Option.Option<HTMLInputElement>
  readonly audioEnabledInput: Option.Option<HTMLInputElement>
  readonly audioCaptionsInput: Option.Option<HTMLInputElement>
  readonly masterVolumeInput: Option.Option<HTMLInputElement>
  readonly sfxVolumeInput: Option.Option<HTMLInputElement>
  readonly musicVolumeInput: Option.Option<HTMLInputElement>
  readonly qualitySelect: Option.Option<HTMLSelectElement>
  readonly closeBtn: Option.Option<HTMLButtonElement>
  readonly gearBtn: Option.Option<HTMLButtonElement>
}

// Matches the classic-Minecraft menu treatment in packages/presentation/menu/main-menu-styles.ts:
// dark panel, bevelled buttons, system-ui (not the Minecraftia/monospace that fell back to Courier).
const SANS_FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'

const panelCss = [
  'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
  'box-sizing:border-box',
  'width:min(420px,calc(100vw - 32px))',
  'max-height:calc(100vh - 48px)',
  'overflow:auto',
  'background:rgba(30,30,30,0.96)',
  'color:#e0e0e0',
  'padding:20px',
  'border:2px solid #000',
  'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.15),inset -2px -2px 0 rgba(0,0,0,0.5),0 12px 28px rgba(0,0,0,0.55)',
  `font-family:${SANS_FONT}`,
  'text-shadow:1px 1px 0 #1a1a1a',
  'z-index:5800',
  'display:none',
].join(';')

const labelBlockCss = 'display:block;margin-bottom:12px;font-size:13px;line-height:1.45'
const labelRowCss = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;cursor:pointer;font-size:13px;line-height:1.45'
const descriptionCss = 'margin:0 0 14px;font-size:12px;line-height:1.5;text-align:center;color:#c8c8c8'
const controlCss = [
  'display:block',
  'box-sizing:border-box',
  'width:100%',
  'margin-top:6px',
  'padding:7px 8px',
  'background:#2a2a2a',
  'color:#fff',
  'border:2px solid #000',
  'border-radius:0',
  'box-shadow:inset 2px 2px 0 #101010,inset -2px -2px 0 #4a4a4a',
  `font-family:${SANS_FONT}`,
].join(';')
const rangeCss = 'display:block;width:100%;margin-top:6px;accent-color:#74b84a'
const closeButtonCss = [
  'flex:1',
  'box-sizing:border-box',
  'padding:9px 12px',
  'min-height:40px',
  'cursor:pointer',
  // WCAG AA (4.5:1): pure-white label on a gradient whose LIGHTEST stop (#6d6d6d)
  // still yields 5.36:1. The old #e0e0e0-on-#7e7e7e was 3.92:1 — a real fail.
  // Kept the vanilla beveled-gray look, just a shade darker + brighter text.
  'background-color:#5c5c5c',
  'background-image:linear-gradient(180deg,#6d6d6d 0%,#5c5c5c 52%,#4a4a4a 100%)',
  'color:#ffffff',
  'border:2px solid #000',
  'border-radius:0',
  'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.35),inset -2px -2px 0 rgba(0,0,0,0.35)',
  `font-family:${SANS_FONT}`,
  'font-size:15px',
  'font-weight:600',
  'text-shadow:1px 1px 0 #383838',
].join(';')

/* c8 ignore next 2 */
export const buildSettingsOverlayDom = (dom: DomOperationsService): SettingsOverlayDom => {
  if (typeof document === 'undefined') {
    return {
      overlayEl: Option.none<HTMLDivElement>(),
      renderDistanceInput: Option.none<HTMLInputElement>(),
      adaptivePerformanceInput: Option.none<HTMLInputElement>(),
      difficultySelect: Option.none<HTMLSelectElement>(),
      reducedMotionInput: Option.none<HTMLInputElement>(),
      uiScaleInput: Option.none<HTMLInputElement>(),
      colorVisionSelect: Option.none<HTMLSelectElement>(),
      keyBindingsContainer: Option.none<HTMLDivElement>(),
      sensitivityInput: Option.none<HTMLInputElement>(),
      fovInput: Option.none<HTMLInputElement>(),
      dayLengthInput: Option.none<HTMLInputElement>(),
      audioEnabledInput: Option.none<HTMLInputElement>(),
      audioCaptionsInput: Option.none<HTMLInputElement>(),
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
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-labelledby', 'settings-overlay-title')
  el.setAttribute('aria-describedby', 'settings-overlay-description')

  dom.setInnerHTML(el, `
    <h2 id="settings-overlay-title" style="margin:0 0 8px;font-size:18px;text-align:center;font-weight:700">Options</h2>
    <p id="settings-overlay-description" style="${descriptionCss}">Changes apply immediately. Use Done to return.</p>
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
      Difficulty:
      <select id="difficulty-select" style="${controlCss}">
        <option value="peaceful">Peaceful</option>
        <option value="easy">Easy</option>
        <option value="normal" selected>Normal</option>
        <option value="hard">Hard</option>
      </select>
    </label>
    <label style="${labelRowCss}">
      <input id="reduced-motion-input" type="checkbox" style="margin:0">
      <span>Reduce camera motion (bob/roll)</span>
    </label>
    <label style="${labelBlockCss}">
      UI Scale: <span id="us-val">100%</span>
      <input id="us-input" type="range" min="0.75" max="1.5" step="0.05" value="1"
        style="${rangeCss}">
    </label>
    <label style="${labelBlockCss}">
      Colorblind Filter:
      <select id="color-vision-select" style="${controlCss}">
        <option value="off" selected>Off</option>
        <option value="protanopia">Protanopia (red-blind)</option>
        <option value="deuteranopia">Deuteranopia (green-blind)</option>
        <option value="tritanopia">Tritanopia (blue-blind)</option>
      </select>
    </label>
    <hr style="border:0;border-top:3px solid #3f3f3f;border-bottom:3px solid #ababab;margin:16px 0">
    <h3 style="margin:0 0 8px;font-size:14px">Controls</h3>
    <p style="${descriptionCss}">Click a field, then press the new key. Blank restores the default.</p>
    <div id="key-bindings" style="display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center;margin-bottom:12px"></div>
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
    <label style="${labelBlockCss}">
      Field of View: <span id="fov-val">75</span>
      <input id="fov-input" type="range" min="30" max="110" step="1" value="75"
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
    <label style="${labelRowCss};margin-bottom:8px">
      <input id="audio-captions-input" type="checkbox" style="margin:0">
      <span>Show sound captions</span>
    </label>
    <label style="${labelBlockCss};margin-bottom:8px">
      Master Volume: <span id="mv-val">100%</span>
      <input id="mv-input" type="range" min="0" max="1" step="0.05" value="1"
        aria-label="Master volume" aria-valuetext="100%"
        style="${rangeCss}">
    </label>
    <label style="${labelBlockCss};margin-bottom:8px">
      SFX Volume: <span id="sv-val">100%</span>
      <input id="sv-input" type="range" min="0" max="1" step="0.05" value="1"
        aria-label="SFX volume" aria-valuetext="100%"
        style="${rangeCss}">
    </label>
    <label style="${labelBlockCss};margin-bottom:12px">
      Music Volume: <span id="muv-val">100%</span>
      <input id="muv-input" type="range" min="0" max="1" step="0.05" value="1"
        aria-label="Music volume" aria-valuetext="100%"
        style="${rangeCss}">
    </label>
    <div style="display:flex;gap:8px">
      <button id="settings-close" aria-label="Close settings" style="${closeButtonCss}">Done</button>
    </div>
  `)

  dom.appendChild(el)

  const btn = dom.createElement('button')
  btn.id = 'settings-gear-btn'
  btn.textContent = 'Options...'
  btn.setAttribute('aria-label', 'Open options')
  btn.setAttribute('aria-haspopup', 'dialog')
  btn.setAttribute('aria-controls', 'settings-overlay')
  btn.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px',
    // WCAG AA: white on the darker gradient (5.36:1 lightest stop); the old
    // #e0e0e0-on-#7e7e7e gear button was 3.92:1.
    'background-color:#5c5c5c',
    'background-image:linear-gradient(180deg,#6d6d6d 0%,#5c5c5c 52%,#4a4a4a 100%)',
    'color:#ffffff',
    'border:2px solid #000',
    'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.35),inset -2px -2px 0 rgba(0,0,0,0.35),0 3px 0 rgba(0,0,0,0.3)',
    'font-size:13px',
    'font-weight:600',
    'line-height:1',
    'padding:9px 13px',
    'min-height:36px',
    'cursor:pointer',
    'border-radius:0',
    'z-index:5500',
    `font-family:${SANS_FONT}`,
    'text-shadow:1px 1px 0 #383838',
  ].join(';')
  dom.appendChild(btn)

  return {
    overlayEl: Option.some(el),
    adaptivePerformanceInput: dom.querySelector<HTMLInputElement>(el, '#adaptive-performance-input'),
    renderDistanceInput: dom.querySelector<HTMLInputElement>(el, '#rd-input'),
    sensitivityInput: dom.querySelector<HTMLInputElement>(el, '#ms-input'),
    fovInput: dom.querySelector<HTMLInputElement>(el, '#fov-input'),
    dayLengthInput: dom.querySelector<HTMLInputElement>(el, '#dl-input'),
    audioEnabledInput: dom.querySelector<HTMLInputElement>(el, '#audio-enabled-input'),
    audioCaptionsInput: dom.querySelector<HTMLInputElement>(el, '#audio-captions-input'),
    masterVolumeInput: dom.querySelector<HTMLInputElement>(el, '#mv-input'),
    sfxVolumeInput: dom.querySelector<HTMLInputElement>(el, '#sv-input'),
    musicVolumeInput: dom.querySelector<HTMLInputElement>(el, '#muv-input'),
    qualitySelect: dom.querySelector<HTMLSelectElement>(el, '#quality-select'),
    difficultySelect: dom.querySelector<HTMLSelectElement>(el, '#difficulty-select'),
    reducedMotionInput: dom.querySelector<HTMLInputElement>(el, '#reduced-motion-input'),
    uiScaleInput: dom.querySelector<HTMLInputElement>(el, '#us-input'),
    colorVisionSelect: dom.querySelector<HTMLSelectElement>(el, '#color-vision-select'),
    keyBindingsContainer: dom.querySelector<HTMLDivElement>(el, '#key-bindings'),
    closeBtn: dom.querySelector<HTMLButtonElement>(el, '#settings-close'),
    gearBtn: Option.some(btn),
  }
  /* c8 ignore stop */
}
