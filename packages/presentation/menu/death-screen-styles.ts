const Z_INDEX = 1100

export const BACKDROP_STYLE = [
  'position:fixed',
  'top:0',
  'left:0',
  'width:100vw',
  'height:100vh',
  // Red tint conveys death without obscuring the world too much.
  'background:rgba(85,8,8,0.55)',
  'display:none',
  'align-items:center',
  'justify-content:center',
  `z-index:${Z_INDEX}`,
  'font-family:monospace',
].join(';')

export const PANEL_STYLE = [
  'background:rgba(10,10,10,0.92)',
  'color:#fff',
  'padding:36px 48px',
  'border-radius:10px',
  'min-width:320px',
  'border:1px solid #5a1a1a',
  'box-shadow:0 12px 48px rgba(0,0,0,0.7)',
  'display:flex',
  'flex-direction:column',
  'align-items:stretch',
  'gap:14px',
].join(';')

export const TITLE_STYLE = [
  'font-size:32px',
  'font-weight:bold',
  'text-align:center',
  'color:#ff5555',
  'margin-bottom:12px',
  'letter-spacing:4px',
  'text-shadow:0 2px 6px rgba(0,0,0,0.8)',
].join(';')

export const BUTTON_STYLE = [
  'padding:10px 18px',
  'background:#3a1f1f',
  'color:#fff',
  'border:1px solid #6a2a2a',
  'border-radius:4px',
  'cursor:pointer',
  'font-family:monospace',
  'font-size:14px',
  'min-width:220px',
  'text-align:center',
].join(';')
