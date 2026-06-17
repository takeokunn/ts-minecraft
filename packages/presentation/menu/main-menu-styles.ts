export const overlayBaseStyle = [
  'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
  'background:linear-gradient(#83b7ff 0 44%,#4e8f2f 44% 49%,#8a5a32 49% 100%)',
  'color:#fff', 'font-family:"Courier New",monospace',
  'text-shadow:2px 2px #222', 'image-rendering:pixelated',
  'display:flex', 'align-items:center', 'justify-content:center', 'flex-direction:column',
  'z-index:5000',
].join(';')

export const cardStyle = [
  'background:#c6c6c6', 'padding:18px',
  'border:2px solid #111',
  'box-shadow:inset 3px 3px #fff,inset -3px -3px #555,0 12px 0 rgba(0,0,0,0.35)',
  'min-width:min(420px,calc(100vw - 32px))',
  'display:flex', 'flex-direction:column', 'gap:12px',
  'color:#202020', 'text-shadow:none',
].join(';')

export const buttonStyle = [
  'padding:10px 16px', 'cursor:pointer',
  'background:#737373', 'border:2px solid #111', 'color:#fff',
  'box-shadow:inset 2px 2px #bcbcbc,inset -2px -2px #2d2d2d',
  'font-family:"Courier New",monospace', 'font-size:16px',
  'min-height:40px', 'text-shadow:2px 2px #222',
].join(';')

export const dangerButtonStyle = [
  'padding:8px 12px', 'cursor:pointer',
  'background:#8f3434', 'border:2px solid #111', 'color:#fff',
  'box-shadow:inset 2px 2px #d17a7a,inset -2px -2px #421717',
  'font-family:"Courier New",monospace', 'font-size:14px',
  'text-shadow:2px 2px #222',
].join(';')

export const inputStyle = [
  'padding:8px 12px', 'background:#222', 'color:#fff',
  'border:2px solid #111',
  'box-shadow:inset 2px 2px #080808,inset -2px -2px #555',
  'font-family:"Courier New",monospace', 'font-size:14px',
].join(';')
