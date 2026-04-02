import { Effect, Option } from 'effect'
import { DomOperationsService } from '@/presentation/hud/crosshair'

export class LoadingScreenService extends Effect.Service<LoadingScreenService>()(
  '@minecraft/presentation/LoadingScreen',
  {
    scoped: Effect.flatMap(DomOperationsService, (dom) =>
      Effect.acquireRelease(
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

          dom.setInnerHTML(el, `
            <div style="color:#fff;font-size:32px;font-family:monospace;text-shadow:2px 2px 4px rgba(0,0,0,0.8);margin-bottom:24px">ts-minecraft</div>
            <div class="loading-spinner" style="width:48px;height:48px;border:4px solid rgba(255,255,255,0.2);border-top:4px solid #fff;border-radius:50%"></div>
            <div style="color:#fff;font-family:monospace;font-size:16px;margin-top:16px">Loading...</div>
          `)

          dom.appendChild(el)

          return { overlayEl: Option.some(el), styleEl: Option.some(styleEl) }
        }),
        ({ overlayEl, styleEl }) => Effect.sync(() => {
          Option.match(overlayEl, {
            onNone: () => {},
            onSome: (el) => dom.removeChild(el),
          })
          Option.match(styleEl, {
            onNone: () => {},
            onSome: (s) => { if (s.parentNode) s.parentNode.removeChild(s) },
          })
        })
      ).pipe(
        Effect.map(({ overlayEl }) => ({
          hide: (): Effect.Effect<void, never> => Effect.sync(() => {
            Option.match(overlayEl, {
              onNone: () => {},
              onSome: (el) => { el.style.display = 'none' },
            })
          }),
        }))
      )
    ),
  }
) {}

export const LoadingScreenLive = LoadingScreenService.Default
