const UI_FONT = '"Trebuchet MS","Avenir Next",Avenir,sans-serif'
const DISPLAY_FONT = 'Impact,"Arial Black","Trebuchet MS",sans-serif'

export const overlayBaseStyle = [
  'position:fixed', 'inset:0', 'width:100vw', 'height:100vh', 'height:100dvh',
  'box-sizing:border-box',
  'background-color:#111d24',
  'background-image:linear-gradient(180deg,rgba(7,17,24,0.08) 0%,rgba(13,24,28,0.2) 42%,rgba(5,10,12,0.9) 100%),linear-gradient(135deg,#d88945 0%,#8b5760 29%,#304858 62%,#14242b 100%)',
  'background-size:cover',
  'color:#f4ecd8', `font-family:${UI_FONT}`,
  'text-shadow:0 2px 0 rgba(0,0,0,0.72)',
  'padding:max(18px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left))',
  'overflow:auto', 'overscroll-behavior:contain',
  'display:flex', 'align-items:center', 'justify-content:center', 'flex-direction:column',
  'isolation:isolate', 'z-index:5000',
].join(';')

export const cardStyle = [
  'position:relative', 'z-index:1',
  'background:linear-gradient(145deg,rgba(21,30,28,0.94),rgba(8,15,17,0.97))',
  'padding:clamp(18px,4vw,30px)',
  'border:1px solid rgba(238,200,126,0.42)',
  'border-radius:3px',
  'box-shadow:0 0 0 3px rgba(4,8,9,0.68),0 24px 70px rgba(0,0,0,0.58),inset 0 1px 0 rgba(255,244,204,0.12)',
  'box-sizing:border-box',
  'width:min(440px,100%)', 'max-width:100%',
  'display:flex', 'flex-direction:column', 'gap:12px',
  'color:#eee6d4', 'text-shadow:0 2px 0 #080b0b',
].join(';')

export const buttonStyle = [
  'display:block', 'width:100%', 'box-sizing:border-box',
  'padding:10px 16px', 'min-height:44px', 'cursor:pointer',
  'background-color:#405341',
  'background-image:linear-gradient(180deg,#596d52 0%,#405341 54%,#314032 100%)',
  'border:1px solid #a7bd80', 'border-radius:2px', 'color:#fffdf2',
  'box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -3px 0 rgba(0,0,0,0.25),0 3px 0 #172019',
  `font-family:${UI_FONT}`,
  'font-size:14px', 'font-weight:800', 'letter-spacing:0.055em',
  'text-shadow:0 2px 0 #172019', 'image-rendering:pixelated',
  'transition:transform 120ms ease,filter 120ms ease,box-shadow 120ms ease',
].join(';')

export const dangerButtonStyle = [
  'display:block', 'box-sizing:border-box',
  'padding:10px 14px', 'min-height:44px', 'cursor:pointer',
  'background-color:#793b31',
  'background-image:linear-gradient(180deg,#995246 0%,#793b31 54%,#5b2924 100%)',
  'border:1px solid #d28a72', 'border-radius:2px', 'color:#fffaf2',
  'box-shadow:inset 0 1px 0 rgba(255,255,255,0.18),inset 0 -3px 0 rgba(0,0,0,0.28),0 3px 0 #2c1412',
  `font-family:${UI_FONT}`,
  'font-size:14px', 'font-weight:800', 'letter-spacing:0.04em',
  'text-shadow:0 2px 0 #321513',
  'transition:transform 120ms ease,filter 120ms ease,box-shadow 120ms ease',
].join(';')

export const inputStyle = [
  'padding:10px 12px', 'min-height:44px', 'box-sizing:border-box', 'width:100%',
  'background:#111a1b', 'color:#fff9e9', 'caret-color:#f4c86b',
  'border:1px solid #59665b', 'border-radius:2px',
  'box-shadow:inset 0 2px 5px rgba(0,0,0,0.7)',
  `font-family:${UI_FONT}`, 'font-size:16px',
].join(';')

export const menuButtonHoverCss = `
#main-menu-overlay::before {
  content:""; position:fixed; z-index:-2; inset:auto 0 0; height:48%; pointer-events:none;
  background:
    linear-gradient(153deg,transparent 0 25%,#28392d 25.2% 44%,transparent 44.2%) 0 100%/44% 100% no-repeat,
    linear-gradient(207deg,transparent 0 30%,#1c2d27 30.2% 58%,transparent 58.2%) 100% 100%/58% 92% no-repeat,
    repeating-linear-gradient(90deg,#101b18 0 7%,#15241e 7% 14%);
  clip-path:polygon(0 32%,8% 32%,8% 18%,18% 18%,18% 38%,29% 38%,29% 8%,43% 8%,43% 47%,55% 47%,55% 24%,69% 24%,69% 39%,80% 39%,80% 13%,92% 13%,92% 31%,100% 31%,100% 100%,0 100%);
}
#main-menu-overlay::after {
  content:""; position:fixed; z-index:-1; inset:0; pointer-events:none; opacity:.24;
  background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
  background-size:4px 4px;
}
#main-menu-overlay .mc-menu-card { animation:mc-menu-enter 420ms cubic-bezier(.2,.75,.25,1) both; }
#main-menu-overlay .mc-menu-eyebrow { margin:0 0 2px; color:#f4c86b; font-size:11px; font-weight:900; letter-spacing:.24em; text-align:center; text-transform:uppercase; }
#main-menu-overlay .mc-menu-title { margin:0 0 12px; color:#fff8df; font-family:${DISPLAY_FONT}; font-size:clamp(34px,10vw,54px); font-weight:900; letter-spacing:.035em; line-height:.92; text-align:center; text-transform:uppercase; text-shadow:0 3px 0 #81542d,0 6px 0 #302014,0 12px 28px #000; transform:skew(-2deg); }
#main-menu-overlay .mc-menu-title span { color:#f3be5c; }
#main-menu-overlay .mc-menu-copy { margin:0 0 2px; color:#d7d0bd; font-size:13px; line-height:1.5; text-align:center; }
#main-menu-overlay .mc-menu-support { display:flex; flex-wrap:wrap; justify-content:center; gap:5px 12px; margin:0 0 4px; color:#aeb9ab; font-size:11px; line-height:1.35; text-align:center; }
#main-menu-overlay .mc-menu-actions { display:flex; gap:8px; margin-top:8px; }
#main-menu-overlay .mc-menu-btn:hover { filter:brightness(1.14); transform:translateY(-1px); }
#main-menu-overlay .mc-menu-btn-danger:hover { filter:brightness(1.12); transform:translateY(-1px); }
#main-menu-overlay .mc-menu-btn:active,#main-menu-overlay .mc-menu-btn-danger:active { transform:translateY(2px); box-shadow:inset 0 2px 3px rgba(0,0,0,.35),0 1px 0 #172019; }
#main-menu-overlay .mc-menu-btn:focus { outline:none; }
#main-menu-overlay .mc-menu-btn:focus-visible,#main-menu-overlay .mc-menu-btn-danger:focus-visible,#main-menu-overlay input:focus-visible { outline:3px solid #ffe090; outline-offset:3px; box-shadow:0 0 0 6px rgba(20,29,25,.94),0 0 0 8px rgba(255,224,144,.32); }
#main-menu-overlay .mc-menu-btn:disabled { cursor:not-allowed; filter:saturate(.25); opacity:.48; transform:none; }
@keyframes mc-menu-enter { from { opacity:0; transform:translateY(18px) scale(.98); } to { opacity:1; transform:none; } }
@media (max-width:420px) {
  #main-menu-overlay { align-items:stretch !important; justify-content:flex-start !important; }
  #main-menu-overlay .mc-menu-card { margin:auto 0; }
  #main-menu-overlay .mc-menu-actions { flex-direction:column-reverse; }
  #main-menu-overlay .mc-menu-support { display:none; }
  #main-menu-overlay .mc-menu-title { font-size:clamp(30px,13vw,44px); }
  #main-menu-overlay .mc-world-row .mc-menu-btn,#main-menu-overlay .mc-world-row .mc-menu-btn-danger { flex:1 1 calc(50% - 4px); }
}
@media (max-height:640px) {
  #main-menu-overlay { align-items:stretch !important; justify-content:flex-start !important; }
  #main-menu-overlay .mc-menu-card { margin:auto; }
  #main-menu-overlay .mc-menu-title { margin-bottom:7px; font-size:32px; }
  #main-menu-overlay .mc-menu-copy,#main-menu-overlay .mc-menu-support { display:none; }
}
@media (prefers-reduced-motion:reduce) {
  #main-menu-overlay .mc-menu-card { animation:none; }
  #main-menu-overlay .mc-menu-btn,#main-menu-overlay .mc-menu-btn-danger { transition:none; }
}
`
