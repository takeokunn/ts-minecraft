import { Effect, Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

const ERROR_TITLE_ID = 'loading-error-title'
const ERROR_MESSAGE_ID = 'loading-error-message'
const ERROR_DETAIL_ID = 'loading-error-detail'

const clearElementChildren = (element: HTMLElement): void => {
  while (element.firstChild) element.removeChild(element.firstChild)
}

const createElement = (
  dom: DomOperationsService,
  tag: keyof HTMLElementTagNameMap,
  className: string,
  text?: string,
): HTMLElement => {
  const element = dom.createElement(tag)
  element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

const createBrand = (dom: DomOperationsService): HTMLElement => {
  const brand = createElement(dom, 'div', 'loading-brand')
  brand.setAttribute('aria-hidden', 'true')
  dom.appendChildTo(brand, createElement(dom, 'span', 'loading-brand-mark', 'TS'))
  dom.appendChildTo(brand, createElement(dom, 'span', 'loading-brand-name', 'MINECRAFT'))
  return brand
}

const createWorldIndicator = (dom: DomOperationsService): HTMLElement => {
  const scene = createElement(dom, 'div', 'loading-scene')
  scene.setAttribute('aria-hidden', 'true')
  const orbit = createElement(dom, 'div', 'loading-orbit')
  for (let index = 1; index <= 3; index += 1) {
    dom.appendChildTo(orbit, createElement(dom, 'span', `loading-cube loading-cube-${index}`))
  }
  dom.appendChildTo(scene, orbit)
  return scene
}

const renderLoadingView = (dom: DomOperationsService, overlay: HTMLDivElement): void => {
  overlay.removeAttribute('role')
  overlay.removeAttribute('aria-modal')
  overlay.removeAttribute('aria-labelledby')
  overlay.removeAttribute('aria-describedby')
  overlay.setAttribute('aria-busy', 'true')
  overlay.setAttribute('aria-label', 'Preparing your Minecraft world')
  clearElementChildren(overlay)

  const shell = createElement(dom, 'main', 'loading-shell')
  dom.appendChildTo(shell, createBrand(dom))
  dom.appendChildTo(shell, createWorldIndicator(dom))
  const status = createElement(dom, 'section', 'loading-copy')
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  status.setAttribute('aria-atomic', 'true')
  dom.appendChildTo(status, createElement(dom, 'p', 'loading-kicker', 'WORLD GENERATION'))
  dom.appendChildTo(status, createElement(dom, 'h1', 'loading-title', 'Preparing your world'))
  dom.appendChildTo(status, createElement(
    dom,
    'p',
    'loading-detail',
    'Shaping terrain, placing blocks, and lighting the horizon.',
  ))
  const track = createElement(dom, 'div', 'loading-track')
  track.setAttribute('aria-hidden', 'true')
  dom.appendChildTo(track, createElement(dom, 'span', 'loading-track-fill'))
  dom.appendChildTo(status, track)
  dom.appendChildTo(shell, status)
  dom.appendChildTo(overlay, shell)
}

const renderErrorView = (
  dom: DomOperationsService,
  overlay: HTMLDivElement,
  message: string,
  detailText = 'Check your connection or refresh the page to try again.',
): void => {
  overlay.setAttribute('role', 'alertdialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-busy', 'false')
  overlay.removeAttribute('aria-label')
  overlay.setAttribute('aria-labelledby', ERROR_TITLE_ID)
  overlay.setAttribute('aria-describedby', `${ERROR_MESSAGE_ID} ${ERROR_DETAIL_ID}`)
  overlay.tabIndex = -1
  clearElementChildren(overlay)

  const shell = createElement(dom, 'main', 'loading-shell loading-shell-error')
  dom.appendChildTo(shell, createBrand(dom))
  const icon = createElement(dom, 'div', 'loading-error-icon', '!')
  icon.setAttribute('aria-hidden', 'true')
  dom.appendChildTo(shell, icon)
  const copy = createElement(dom, 'section', 'loading-copy')
  dom.appendChildTo(copy, createElement(dom, 'p', 'loading-kicker loading-kicker-error', 'WORLD INTERRUPTED'))
  const title = createElement(dom, 'h1', 'loading-title', "We couldn't build this world")
  title.id = ERROR_TITLE_ID
  dom.appendChildTo(copy, title)
  const errorMessage = createElement(dom, 'p', 'loading-error-message', message)
  errorMessage.id = ERROR_MESSAGE_ID
  dom.appendChildTo(copy, errorMessage)
  const detail = createElement(dom, 'p', 'loading-detail', detailText)
  detail.id = ERROR_DETAIL_ID
  dom.appendChildTo(copy, detail)
  dom.appendChildTo(shell, copy)
  dom.appendChildTo(overlay, shell)
  overlay.focus({ preventScroll: true })
}

const LOADING_STYLES = `
#loading-screen{isolation:isolate;overflow:hidden;color:#f8f2dd;font-family:"Trebuchet MS","Avenir Next",sans-serif}
#loading-screen::before{content:"";position:absolute;inset:-20%;z-index:-2;background:radial-gradient(circle at 18% 22%,rgba(229,177,65,.24),transparent 25%),radial-gradient(circle at 82% 74%,rgba(74,143,93,.22),transparent 28%),linear-gradient(145deg,#10281f,#17372a 48%,#091b16);animation:loading-drift 10s ease-in-out infinite alternate}
#loading-screen::after{content:"";position:absolute;inset:0;z-index:-1;opacity:.2;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(to bottom,black,transparent 85%)}
.loading-shell{box-sizing:border-box;width:min(100%,34rem);padding:clamp(1.5rem,5vw,3.25rem);border:1px solid rgba(247,222,156,.24);border-radius:2px;background:linear-gradient(150deg,rgba(22,48,38,.92),rgba(8,27,21,.88));box-shadow:0 2rem 5rem rgba(0,0,0,.36),inset 0 1px rgba(255,255,255,.08);text-align:center;backdrop-filter:blur(14px);animation:loading-arrive .6s cubic-bezier(.2,.8,.2,1) both}
.loading-brand{display:flex;align-items:center;justify-content:center;gap:.65rem;color:#ead18c;font:700 .72rem/1 "Courier New",monospace;letter-spacing:.28em}.loading-brand-mark{display:grid;place-items:center;width:2rem;height:2rem;border:1px solid #d9b65b;background:#d9b65b;color:#11281f;letter-spacing:0;box-shadow:.25rem .25rem 0 rgba(0,0,0,.22)}
.loading-scene{display:grid;place-items:center;height:9.5rem;perspective:500px}.loading-orbit{position:relative;width:6rem;height:6rem;border:1px solid rgba(234,209,140,.28);border-radius:50%;animation:loading-orbit 4s linear infinite}.loading-cube{position:absolute;width:1.45rem;height:1.45rem;background:linear-gradient(135deg,#8baa5f,#476e42);border:1px solid rgba(255,255,255,.25);box-shadow:.3rem .4rem .7rem rgba(0,0,0,.3);transform:rotate(45deg)}
.loading-cube-1{top:-.65rem;left:2.15rem}.loading-cube-2{right:-.55rem;bottom:.65rem;background:linear-gradient(135deg,#d5b55d,#876c2e)}.loading-cube-3{bottom:.55rem;left:-.55rem;background:linear-gradient(135deg,#7194a0,#315663)}
.loading-kicker{margin:0 0 .65rem;color:#d9b65b;font:700 .72rem/1.4 "Courier New",monospace;letter-spacing:.2em}.loading-title{margin:0;color:#fff8e5;font:700 clamp(1.65rem,7vw,2.55rem)/1.08 Georgia,serif;letter-spacing:-.035em;text-wrap:balance}.loading-detail,.loading-error-message{max-width:27rem;margin:1rem auto 0;color:#b8c9bd;font-size:.95rem;line-height:1.65;text-wrap:pretty}
.loading-track{position:relative;height:3px;margin:1.75rem auto 0;overflow:hidden;background:rgba(255,255,255,.1)}.loading-track-fill{position:absolute;inset:0 auto 0 0;width:42%;background:linear-gradient(90deg,transparent,#e7c66d,#fff4bc);animation:loading-progress 1.8s ease-in-out infinite}.loading-error-message{padding:.8rem 1rem;border-left:3px solid #e27b59;background:rgba(226,123,89,.1);color:#ffe2d8;text-align:left;overflow-wrap:anywhere}.loading-error-icon{display:grid;place-items:center;width:4.75rem;height:4.75rem;margin:2.5rem auto 2rem;border:1px solid rgba(226,123,89,.6);background:rgba(226,123,89,.12);color:#ffaf91;font:700 2.25rem/1 Georgia,serif;transform:rotate(45deg)}.loading-kicker-error{color:#ffaf91}
@keyframes loading-arrive{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}@keyframes loading-drift{to{transform:translate3d(2%,1%,0) scale(1.03)}}@keyframes loading-orbit{to{transform:rotate(360deg)}}@keyframes loading-progress{from{transform:translateX(-110%)}to{transform:translateX(340%)}}
@media (max-width:320px){.loading-shell{padding:1.25rem}.loading-scene{height:7.5rem}.loading-title{font-size:1.55rem}.loading-detail{font-size:.84rem}.loading-error-icon{margin:1.75rem auto 1.5rem}}
@media (prefers-reduced-motion:reduce){#loading-screen::before,.loading-shell,.loading-orbit,.loading-track-fill{animation:none}.loading-track-fill{left:29%;width:42%;opacity:.8}}
`

const createOverlay = (dom: DomOperationsService): HTMLDivElement => {
  const overlay = dom.createElement('div')
  overlay.id = 'loading-screen'
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2000', 'box-sizing:border-box',
    'width:100%', 'min-height:100vh', 'min-height:100dvh',
    'display:grid', 'place-items:center', 'overflow:auto',
    'padding:max(1.25rem,env(safe-area-inset-top)) max(1.25rem,env(safe-area-inset-right)) max(1.25rem,env(safe-area-inset-bottom)) max(1.25rem,env(safe-area-inset-left))',
  ].join(';')
  renderLoadingView(dom, overlay)
  return overlay
}

export class LoadingScreenService extends Effect.Service<LoadingScreenService>()(
  '@minecraft/presentation/LoadingScreen',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      const { overlayEl } = yield* Effect.acquireRelease(
        Effect.sync(() => {
          if (typeof document === 'undefined') {
            return { overlayEl: Option.none<HTMLDivElement>(), styleEl: Option.none<HTMLStyleElement>() }
          }
          const styleEl = dom.createElement('style')
          styleEl.textContent = LOADING_STYLES
          document.head.appendChild(styleEl)
          const overlay = createOverlay(dom)
          dom.appendChild(overlay)
          return { overlayEl: Option.some(overlay), styleEl: Option.some(styleEl) }
        }),
        ({ overlayEl, styleEl }) => Effect.sync(() => {
          const overlay = Option.getOrNull(overlayEl)
          if (overlay !== null) dom.removeChild(overlay)
          const style = Option.getOrNull(styleEl)
          if (style?.parentNode) style.parentNode.removeChild(style)
        }),
      )
      return {
        show: (): Effect.Effect<void, never> => Effect.sync(() => {
          const overlay = Option.getOrNull(overlayEl)
          if (overlay !== null) {
            overlay.style.display = 'grid'
            renderLoadingView(dom, overlay)
          }
        }),
        hide: (): Effect.Effect<void, never> => Effect.sync(() => {
          const overlay = Option.getOrNull(overlayEl)
          if (overlay !== null) overlay.style.display = 'none'
        }),
        showError: (message: string, detailText?: string): Effect.Effect<void, never> => Effect.sync(() => {
          const overlay = Option.getOrNull(overlayEl)
          if (overlay !== null) {
            overlay.style.display = 'grid'
            renderErrorView(dom, overlay, message, detailText)
          }
        }),
      }
    }),
  },
) {}
