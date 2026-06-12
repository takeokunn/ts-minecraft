import { Effect, Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'

const clearElementChildren = (element: HTMLElement): void => {
  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }
}

const createBaseTitle = (dom: DomOperationsService): HTMLDivElement => {
  const title = dom.createElement('div')
  title.textContent = 'ts-minecraft'
  title.style.cssText = 'color:#fff;font-size:32px;font-family:monospace;text-shadow:2px 2px 4px rgba(0,0,0,0.8);margin-bottom:24px'
  return title
}

const createLoadingSpinner = (dom: DomOperationsService): HTMLDivElement => {
  const spinner = dom.createElement('div')
  spinner.className = 'loading-spinner'
  spinner.style.cssText = 'width:48px;height:48px;border:4px solid rgba(255,255,255,0.2);border-top:4px solid #fff;border-radius:50%'
  return spinner
}

const createLoadingText = (dom: DomOperationsService): HTMLDivElement => {
  const loadingText = dom.createElement('div')
  loadingText.textContent = 'Loading...'
  loadingText.style.cssText = 'color:#fff;font-family:monospace;font-size:16px;margin-top:16px'
  return loadingText
}

const renderLoadingView = (dom: DomOperationsService, overlayEl: HTMLDivElement): void => {
  clearElementChildren(overlayEl)
  dom.appendChildTo(overlayEl, createBaseTitle(dom))
  dom.appendChildTo(overlayEl, createLoadingSpinner(dom))
  dom.appendChildTo(overlayEl, createLoadingText(dom))
}

const renderErrorView = (dom: DomOperationsService, overlayEl: HTMLDivElement, message: string): void => {
  clearElementChildren(overlayEl)

  const title = createBaseTitle(dom)

  const errorMessage = dom.createElement('div')
  errorMessage.textContent = message
  errorMessage.style.cssText = 'color:#ffb4b4;font-family:monospace;font-size:16px;max-width:680px;text-align:center;line-height:1.6;padding:0 16px'

  const detail = dom.createElement('div')
  detail.textContent = 'Returning to main menu...'
  detail.style.cssText = 'color:#fff;font-family:monospace;font-size:14px;margin-top:16px;opacity:0.9'

  dom.appendChildTo(overlayEl, title)
  dom.appendChildTo(overlayEl, errorMessage)
  dom.appendChildTo(overlayEl, detail)
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

          // Inject spinner keyframes — tracked so the finalizer can remove them on scope close
          const styleEl = dom.createElement('style')
          styleEl.textContent = '@keyframes spin { to { transform: rotate(360deg) } } .loading-spinner { animation: spin 1s linear infinite }'
          document.head.appendChild(styleEl) // appendToHead not on DomOperationsService; direct call acceptable here

          const el = dom.createElement('div')
          el.id = 'loading-screen'
          el.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
            'z-index:2000',
            'background-color:#3d2315',
            'background-image:repeating-linear-gradient(0deg,rgba(0,0,0,0.15) 0px,rgba(0,0,0,0.15) 1px,transparent 1px,transparent 16px),repeating-linear-gradient(90deg,rgba(0,0,0,0.15) 0px,rgba(0,0,0,0.15) 1px,transparent 1px,transparent 16px)',
            'display:flex', 'align-items:center', 'justify-content:center', 'flex-direction:column',
          ].join(';')

          renderLoadingView(dom, el)

          dom.appendChild(el)

          return { overlayEl: Option.some(el), styleEl: Option.some(styleEl) }
        }),
        ({ overlayEl, styleEl }) => Effect.sync(() => {
          const el = Option.getOrNull(overlayEl)
          if (el !== null) dom.removeChild(el)
          const s = Option.getOrNull(styleEl)
          if (s !== null && s.parentNode) s.parentNode.removeChild(s)
        })
      )
      return {
        hide: (): Effect.Effect<void, never> => Effect.sync(() => {
          const el = Option.getOrNull(overlayEl)
          if (el !== null) el.style.display = 'none'
        }),
        showError: (message: string): Effect.Effect<void, never> => Effect.sync(() => {
          const el = Option.getOrNull(overlayEl)
          if (el !== null) {
            el.style.display = 'flex'
            renderErrorView(dom, el, message)
          }
        }),
      }
    }),
  }
) {}

export const LoadingScreenLive = LoadingScreenService.Default
