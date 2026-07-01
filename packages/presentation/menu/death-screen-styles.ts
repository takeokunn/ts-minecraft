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
  'width:min(420px,calc(100vw - 32px))',
  'box-sizing:border-box',
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

export const MESSAGE_STYLE = [
  'font-size:15px',
  'line-height:1.35',
  'min-height:20px',
  'text-align:center',
  'color:#2d2d2d',
  'text-shadow:1px 1px #fff',
  'margin-top:-8px',
  'margin-bottom:4px',
].join(';')

export const HELP_STYLE = [
  'font-size:12px',
  'line-height:1.45',
  'text-align:center',
  'color:#3a3a3a',
  'text-shadow:1px 1px #fff',
  'margin:-4px 0 2px',
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
