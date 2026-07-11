export const TOUCH_CONTROLS_STYLE_ID = 'touch-controls-style'

export const touchControlsCss = `
#touch-controls{position:fixed;inset:0;z-index:120;pointer-events:none;display:none;touch-action:none;user-select:none;-webkit-user-select:none;font-family:"Trebuchet MS",sans-serif;color:#fff}
@media (hover:none) and (pointer:coarse){#touch-controls{display:block}}
#touch-look{position:absolute;inset:0 0 0 44%;pointer-events:auto;touch-action:none}
.touch-cluster{position:absolute;pointer-events:none}
.touch-button{pointer-events:auto;touch-action:none;min-width:52px;min-height:52px;border:2px solid rgba(255,255,255,.62);border-radius:15px;background:linear-gradient(145deg,rgba(31,44,37,.78),rgba(12,19,16,.86));box-shadow:0 3px 0 rgba(0,0,0,.46),inset 0 1px rgba(255,255,255,.22);color:#fff;font:700 12px/1 "Trebuchet MS",sans-serif;letter-spacing:.03em;text-shadow:0 1px 2px #000;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.touch-button[aria-pressed="true"],.touch-button:active{transform:translateY(2px) scale(.96);background:linear-gradient(145deg,rgba(117,157,75,.94),rgba(46,86,51,.94));box-shadow:0 1px 0 rgba(0,0,0,.5),inset 0 0 10px rgba(255,255,255,.18)}
#touch-move{left:max(18px,env(safe-area-inset-left));bottom:max(22px,calc(env(safe-area-inset-bottom) + 18px));width:132px;height:132px;border-radius:50%;pointer-events:auto;touch-action:none;background:radial-gradient(circle,rgba(255,255,255,.09) 0 38%,rgba(20,31,25,.58) 40% 61%,rgba(255,255,255,.32) 63% 65%,transparent 66%)}
#touch-move-knob{position:absolute;left:41px;top:41px;width:50px;height:50px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.76),rgba(91,118,90,.75) 35%,rgba(25,39,31,.92));box-shadow:0 4px 12px rgba(0,0,0,.55);transition:transform 55ms linear}
#touch-actions{right:max(14px,env(safe-area-inset-right));bottom:max(24px,calc(env(safe-area-inset-bottom) + 20px));display:grid;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(2,56px);gap:9px;align-items:center}
#touch-jump{grid-column:3;grid-row:1 / span 2;min-height:82px;border-radius:22px}
#touch-break{grid-column:1;grid-row:1}#touch-use{grid-column:2;grid-row:1}#touch-sneak{grid-column:1;grid-row:2}#touch-sprint{grid-column:2;grid-row:2}
#touch-menu{top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));display:flex;gap:9px}
#touch-menu .touch-button{min-width:50px;min-height:48px;font-size:19px}
#touch-hotbar{left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:3px}
#touch-hotbar .touch-button{min-width:48px;width:48px;min-height:48px;padding:0;border-radius:9px;background:rgba(12,19,16,.36);font-size:11px}
#touch-orientation{display:none;position:absolute;inset:0;place-items:center;padding:32px;background:rgba(7,12,10,.88);pointer-events:auto;text-align:center;z-index:5}
#touch-orientation div{max-width:310px;padding:24px;border:2px solid rgba(255,255,255,.45);border-radius:20px;background:rgba(32,48,39,.92);box-shadow:0 18px 50px rgba(0,0,0,.45)}
#touch-orientation strong{display:block;font-size:22px;margin-bottom:8px}#touch-orientation span{color:#d6e5cf;font-size:15px;line-height:1.45}
@media (hover:none) and (pointer:coarse) and (orientation:portrait) and (max-width:700px){#touch-orientation{display:grid}}
@media (max-height:520px){#touch-hotbar{bottom:max(4px,env(safe-area-inset-bottom))}#touch-hotbar .touch-button{min-width:40px;width:40px;min-height:48px}}
@media (prefers-reduced-motion:reduce){#touch-move-knob{transition:none}.touch-button{transition:none}}
body.hud-hidden #touch-controls{display:none!important}
`
