const Z_INDEX = 1050

export const BACKDROP_STYLE = [
  'position:fixed',
  'top:0',
  'left:0',
  'width:100vw',
  'height:100vh',
  'background:rgba(0,0,0,0.55)',
  'display:none',
  'align-items:center',
  'justify-content:center',
  `z-index:${Z_INDEX}`,
  'font-family:monospace',
].join(';')

export const PANEL_STYLE = [
  'background:rgba(20,20,20,0.92)',
  'color:#fff',
  'padding:32px 40px',
  'border-radius:10px',
  'min-width:280px',
  'border:1px solid #4d4d4d',
  'box-shadow:0 12px 48px rgba(0,0,0,0.6)',
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
  'letter-spacing:2px',
].join(';')

export const BUTTON_STYLE = [
  'padding:10px 16px',
  'background:#3a3a3a',
  'color:#fff',
  'border:1px solid #5a5a5a',
  'border-radius:4px',
  'cursor:pointer',
  'font-family:monospace',
  'font-size:14px',
  'min-width:200px',
  'text-align:center',
].join(';')

export const SAVE_QUIT_CONFIRM_MESSAGE =
  'Save and return to title?\nLast 5s of progress will be flushed first.'
