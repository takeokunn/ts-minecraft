const Z_INDEX = 1050

export const BACKDROP_STYLE = [
  'position:fixed',
  'top:0',
  'left:0',
  'width:100vw',
  'height:100vh',
  'background:rgba(0,0,0,0.58)',
  'display:none',
  'align-items:center',
  'justify-content:center',
  `z-index:${Z_INDEX}`,
  'font-family:"Courier New",monospace',
].join(';')

export const PANEL_STYLE = [
  'background:#c6c6c6',
  'color:#202020',
  'padding:22px 28px',
  'min-width:280px',
  'border:2px solid #111',
  'box-shadow:inset 3px 3px #fff,inset -3px -3px #555,0 12px 0 rgba(0,0,0,0.45)',
  'display:flex',
  'flex-direction:column',
  'align-items:stretch',
  'gap:12px',
].join(';')

export const TITLE_STYLE = [
  'font-size:22px',
  'font-weight:bold',
  'text-align:center',
  'margin-bottom:8px',
  'letter-spacing:0',
].join(';')

export const BUTTON_STYLE = [
  'padding:10px 16px',
  'background:#737373',
  'color:#fff',
  'border:2px solid #111',
  'box-shadow:inset 2px 2px #bcbcbc,inset -2px -2px #2d2d2d',
  'cursor:pointer',
  'font-family:"Courier New",monospace',
  'font-size:14px',
  'min-width:200px',
  'text-align:center',
  'text-shadow:2px 2px #222',
].join(';')

export const SAVE_QUIT_CONFIRM_MESSAGE =
  'Save and return to title?\nLast 5s of progress will be flushed first.'
