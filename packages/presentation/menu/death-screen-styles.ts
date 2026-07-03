const Z_INDEX = 1100

// Vanilla death screen: a translucent deep-red full-screen tint with the big
// shadowed "YOU DIED" floating over the world — no opaque dialog panel.
// Buttons share the beveled look from main-menu-styles.
const SANS_FONT = "system-ui,-apple-system,'Segoe UI',sans-serif"

export const BACKDROP_STYLE = [
  'position:fixed',
  'top:0',
  'left:0',
  'width:100vw',
  'height:100vh',
  'background:rgba(96,10,10,0.6)',
  'display:none',
  'align-items:center',
  'justify-content:center',
  `z-index:${Z_INDEX}`,
  `font-family:${SANS_FONT}`,
].join(';')

export const PANEL_STYLE = [
  'background:transparent',
  'color:#f0f0f0',
  'padding:24px 34px',
  'width:min(460px,calc(100vw - 32px))',
  'box-sizing:border-box',
  'display:flex',
  'flex-direction:column',
  'align-items:stretch',
  'gap:14px',
].join(';')

export const TITLE_STYLE = [
  'font-size:52px',
  'font-weight:900',
  'text-align:center',
  'color:#ffffff',
  'margin-bottom:12px',
  'letter-spacing:2px',
  'text-shadow:3px 3px 0 #3f0000',
].join(';')

export const MESSAGE_STYLE = [
  'font-size:16px',
  'line-height:1.35',
  'min-height:20px',
  'text-align:center',
  'color:#ffe9e9',
  'text-shadow:1px 1px 0 #3f0000',
  'margin-top:-8px',
  'margin-bottom:4px',
].join(';')

export const HELP_STYLE = [
  'font-size:12px',
  'line-height:1.45',
  'text-align:center',
  'color:#e8c9c9',
  'text-shadow:1px 1px 0 #3f0000',
  'margin:-4px 0 2px',
].join(';')

export const BUTTON_STYLE = [
  'padding:9px 18px',
  'min-height:40px',
  'background-color:#6d6d6d',
  'background-image:linear-gradient(180deg,#7e7e7e 0%,#6d6d6d 52%,#5c5c5c 100%)',
  'color:#e0e0e0',
  'border:2px solid #000',
  'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.35),inset -2px -2px 0 rgba(0,0,0,0.35)',
  'cursor:pointer',
  `font-family:${SANS_FONT}`,
  'font-size:15px',
  'font-weight:600',
  'letter-spacing:0.5px',
  'min-width:220px',
  'text-align:center',
  'text-shadow:1px 1px 0 #383838',
  'image-rendering:pixelated',
].join(';')
