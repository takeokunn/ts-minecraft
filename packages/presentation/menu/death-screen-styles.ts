const Z_INDEX = 1100

export const BACKDROP_STYLE = [
  'position:fixed',
  'top:0',
  'left:0',
  'width:100vw',
  'height:100vh',
  'background:rgba(85,8,8,0.55)',
  'display:none',
  'align-items:center',
  'justify-content:center',
  `z-index:${Z_INDEX}`,
  'font-family:"Courier New",monospace',
].join(';')

export const PANEL_STYLE = [
  'background:#c6c6c6',
  'color:#202020',
  'padding:24px 34px',
  'min-width:320px',
  'border:2px solid #111',
  'box-shadow:inset 3px 3px #fff,inset -3px -3px #555,0 12px 0 rgba(0,0,0,0.55)',
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
  'letter-spacing:0',
  'text-shadow:2px 2px #3f0000',
].join(';')

export const BUTTON_STYLE = [
  'padding:10px 18px',
  'background:#737373',
  'color:#fff',
  'border:2px solid #111',
  'box-shadow:inset 2px 2px #bcbcbc,inset -2px -2px #2d2d2d',
  'cursor:pointer',
  'font-family:"Courier New",monospace',
  'font-size:14px',
  'min-width:220px',
  'text-align:center',
  'text-shadow:2px 2px #222',
].join(';')
