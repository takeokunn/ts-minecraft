import { Effect } from 'effect'

export type AirMeterFeedback = Readonly<{
  readonly display: 'none' | 'block'
  readonly textContent: string | null
}>

export const resolveAirMeterFeedback = (airBubbles: number): AirMeterFeedback =>
  airBubbles >= 10
    ? { display: 'none', textContent: null }
    : {
        display: 'block',
        textContent: airBubbles > 0 ? '🫧'.repeat(airBubbles) : '💀 Drowning',
      }

export const syncAirMeterFeedback = (
  airElementOrNull: HTMLElement | null,
  airBubbles: number,
): Effect.Effect<void, never> =>
  airElementOrNull
    ? Effect.sync(() => {
        const feedback = resolveAirMeterFeedback(airBubbles)
        airElementOrNull.style.display = feedback.display
        if (feedback.textContent !== null) {
          airElementOrNull.textContent = feedback.textContent
        }
      })
    : Effect.void
