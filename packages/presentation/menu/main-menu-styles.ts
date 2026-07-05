// Classic Minecraft title-screen look, expressed in the codebase's inline-style idiom.
// The overlay lays a repeating dirt tile behind a dark scrim; panels are near-transparent
// over it, buttons carry the signature bevel, and hover/focus is added via `menuButtonHoverCss`
// (injected once as a <style> because inline styles can't express :hover / :focus).

const SANS_FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif'

export const overlayBaseStyle = [
  'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
  'box-sizing:border-box',
  'background-color:#48484a',
  "background-image:linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)),url('/textures/tile-00-dirt.png')",
  'background-size:auto,64px 64px',
  'background-repeat:no-repeat,repeat',
  'image-rendering:pixelated',
  `color:#d0d0d0`, `font-family:${SANS_FONT}`,
  'text-shadow:2px 2px 0 #1a1a1a',
  'padding:16px', 'overflow:auto',
  'display:flex', 'align-items:center', 'justify-content:center', 'flex-direction:column',
  'z-index:5000',
].join(';')

export const cardStyle = [
  'background:rgba(0,0,0,0.45)', 'padding:22px 20px',
  'border:2px solid rgba(0,0,0,0.6)',
  'box-shadow:0 10px 28px rgba(0,0,0,0.5)',
  'box-sizing:border-box',
  'width:min(420px,calc(100vw - 32px))',
  'max-width:100%',
  'display:flex', 'flex-direction:column', 'gap:12px',
  `color:#d0d0d0`, 'text-shadow:1px 1px 0 #1a1a1a',
].join(';')

export const buttonStyle = [
  'display:block', 'width:100%', 'box-sizing:border-box',
  'padding:9px 16px', 'min-height:40px', 'cursor:pointer',
  // WCAG AA (4.5:1): pure-white label on a gradient whose lightest stop
  // (#6d6d6d) yields 5.36:1. The old #e0e0e0-on-#7e7e7e was 3.92:1 — a real
  // fail across every menu button. Same vanilla bevel, a shade darker.
  'background-color:#5c5c5c',
  'background-image:linear-gradient(180deg,#6d6d6d 0%,#5c5c5c 52%,#4a4a4a 100%)',
  'border:2px solid #000', 'color:#ffffff',
  'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.35),inset -2px -2px 0 rgba(0,0,0,0.35)',
  `font-family:${SANS_FONT}`,
  'font-size:15px', 'font-weight:600', 'letter-spacing:0.5px',
  'text-shadow:1px 1px 0 #383838', 'image-rendering:pixelated',
].join(';')

export const dangerButtonStyle = [
  'display:block', 'box-sizing:border-box',
  'padding:9px 14px', 'min-height:40px', 'cursor:pointer',
  'background-color:#8f3a3a',
  'background-image:linear-gradient(180deg,#a24a4a 0%,#8f3a3a 52%,#7a2f2f 100%)',
  'border:2px solid #000', 'color:#ffffff',  // #f0dede was 4.48:1 on the red gradient; white = 5.66:1 (WCAG AA)
  'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.25),inset -2px -2px 0 rgba(0,0,0,0.4)',
  `font-family:${SANS_FONT}`,
  'font-size:14px', 'font-weight:600',
  'text-shadow:1px 1px 0 #3a1414', 'image-rendering:pixelated',
].join(';')

export const inputStyle = [
  'padding:9px 12px', 'box-sizing:border-box', 'width:100%',
  'background:#2a2a2a', 'color:#fff',
  'border:2px solid #000',
  'box-shadow:inset 2px 2px 0 #101010,inset -2px -2px 0 #4a4a4a',
  `font-family:${SANS_FONT}`, 'font-size:14px',
].join(';')

// Interactive states for the bevelled buttons — inline styles can't carry :hover/:focus,
// so a single scoped <style> is injected into the overlay in buildMenuDOM. Rules use
// !important because they must win over the inline background/border set above.
export const menuButtonHoverCss = `
#main-menu-overlay .mc-menu-btn:hover,
#main-menu-overlay .mc-menu-btn:focus {
  border-color:#ffffff !important;
  background-image:linear-gradient(180deg,#8a9cce 0%,#7a8cbf 52%,#68789f 100%) !important;
  color:#ffffff !important;
  outline:none !important;
}
#main-menu-overlay .mc-menu-btn-danger:hover,
#main-menu-overlay .mc-menu-btn-danger:focus {
  border-color:#ffffff !important;
  background-image:linear-gradient(180deg,#bf5a5a 0%,#a24a4a 52%,#883636 100%) !important;
  outline:none !important;
}
#main-menu-overlay .mc-menu-btn:disabled {
  cursor:not-allowed !important;
  opacity:0.45 !important;
}
`
