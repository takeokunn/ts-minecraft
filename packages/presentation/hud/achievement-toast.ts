import { Effect, MutableRef, Option } from 'effect'

import { DomOperationsService } from './crosshair'

export const ACHIEVEMENT_TOAST_VISIBLE_MS = 3500
export const ACHIEVEMENT_TOAST_FADE_MS = 400

const toastBaseCss = (visible: boolean): string => [
  'position:fixed',
  'top:16px',
  'right:16px',
  'min-width:220px',
  'max-width:320px',
  'padding:10px 14px',
  'background:#2a2a2a',
  'border:2px solid #000',
  'box-shadow:inset 2px 2px 0 rgba(255,255,255,0.14),inset -2px -2px 0 rgba(0,0,0,0.5),0 4px 12px rgba(0,0,0,0.5)',
  'color:#fff',
  'text-shadow:1px 1px 0 #1a1a1a',
  'font-family:system-ui,-apple-system,sans-serif',
  'pointer-events:none',
  'z-index:950',
  `opacity:${visible ? 1 : 0}`,
  `transform:translateX(${visible ? '0' : '24px'})`,
  `transition:opacity ${ACHIEVEMENT_TOAST_FADE_MS}ms ease, transform ${ACHIEVEMENT_TOAST_FADE_MS}ms ease`,
].join(';')

export interface AchievementToast {
  readonly element: HTMLElement
  // Queues a toast; toasts display one at a time for ACHIEVEMENT_TOAST_VISIBLE_MS each.
  readonly show: (title: string, description: string) => Effect.Effect<void, never>
  readonly hide: () => Effect.Effect<void, never>
}

export const makeAchievementToast = (dom: DomOperationsService) =>
  Effect.gen(function* () {
    const element = dom.createElement('div')
    element.id = 'achievement-toast'
    element.setAttribute('role', 'status')
    element.setAttribute('aria-live', 'polite')
    element.style.cssText = toastBaseCss(false)

    const titleEl = dom.createElement('div')
    titleEl.style.cssText = 'font-size:13px;font-weight:bold;color:#ffff55;margin-bottom:2px'
    titleEl.textContent = 'Achievement Unlocked!'
    const nameEl = dom.createElement('div')
    nameEl.style.cssText = 'font-size:15px;font-weight:bold'
    const descEl = dom.createElement('div')
    descEl.style.cssText = 'font-size:12px;opacity:0.85;margin-top:2px'
    element.appendChild(titleEl)
    element.appendChild(nameEl)
    element.appendChild(descEl)

    const queueRef = MutableRef.make<ReadonlyArray<{ title: string; description: string }>>([])
    const timerRef = MutableRef.make<ReturnType<typeof setTimeout> | null>(null)

    const clearTimer = () => {
      const timer = MutableRef.get(timerRef)
      if (timer !== null) {
        clearTimeout(timer)
        MutableRef.set(timerRef, null)
      }
    }

    const displayNext = (): void => {
      const queue = MutableRef.get(queueRef)
      const next = queue[0]
      if (next === undefined) {
        MutableRef.set(timerRef, null)
        element.style.cssText = toastBaseCss(false)
        return
      }
      MutableRef.set(queueRef, queue.slice(1))
      nameEl.textContent = next.title
      descEl.textContent = next.description
      element.style.cssText = toastBaseCss(true)
      MutableRef.set(timerRef, setTimeout(() => {
        element.style.cssText = toastBaseCss(false)
        MutableRef.set(timerRef, setTimeout(displayNext, ACHIEVEMENT_TOAST_FADE_MS))
      }, ACHIEVEMENT_TOAST_VISIBLE_MS))
    }

    const toast: AchievementToast = {
      element,
      show: (title, description) =>
        Effect.sync(() => {
          MutableRef.set(queueRef, [...MutableRef.get(queueRef), { title, description }])
          // Idle (no timer running) → start displaying immediately.
          if (MutableRef.get(timerRef) === null) displayNext()
        }),
      hide: () =>
        Effect.sync(() => {
          clearTimer()
          MutableRef.set(queueRef, [])
          element.style.cssText = toastBaseCss(false)
        }),
    }

    dom.appendChild(element)
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        clearTimer()
        if (Option.isSome(dom.getParentNode(element))) dom.removeChild(element)
      }),
    )

    return toast
  })

export class AchievementToastService extends Effect.Service<AchievementToastService>()(
  '@minecraft/presentation/AchievementToast',
  {
    scoped: Effect.gen(function* () {
      const dom = yield* DomOperationsService
      return yield* makeAchievementToast(dom)
    }),
  },
) {}
