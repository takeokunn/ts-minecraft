export const overlayBaseStyle = [
  'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
  'background:rgba(20,20,30,0.92)',
  'color:#fff', 'font-family:monospace',
  'display:flex', 'align-items:center', 'justify-content:center', 'flex-direction:column',
  'z-index:5000',
].join(';')

export const cardStyle = [
  'background:rgba(0,0,0,0.7)', 'padding:32px',
  'border-radius:8px', 'min-width:360px',
  'display:flex', 'flex-direction:column', 'gap:12px',
].join(';')

export const buttonStyle = [
  'padding:12px 16px', 'cursor:pointer',
  'background:#3a3a4a', 'border:2px solid transparent', 'color:#fff',
  'border-radius:4px', 'font-family:monospace', 'font-size:16px',
].join(';')

export const dangerButtonStyle = [
  'padding:8px 12px', 'cursor:pointer',
  'background:#a23030', 'border:2px solid transparent', 'color:#fff',
  'border-radius:4px', 'font-family:monospace', 'font-size:14px',
].join(';')

export const inputStyle = [
  'padding:8px 12px', 'background:#222', 'color:#fff',
  'border:1px solid #555', 'border-radius:4px',
  'font-family:monospace', 'font-size:14px',
].join(';')
