import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { createDomAutoSaveStatusReporter } from '@ts-minecraft/app/main/session-autosave-status'

const makeStatusElement = (): {
  readonly attributes: Record<string, string>
  readonly element: HTMLElement
} => {
  const attributes: Record<string, string> = {}
  const element = {
    dataset: {},
    setAttribute: (name: string, value: string) => {
      attributes[name] = value
    },
    textContent: '',
    title: '',
  } as unknown as HTMLElement

  return { attributes, element }
}

describe('session-autosave-status', () => {
  it.effect('writes canonical autosave status text and metadata to the DOM element', () =>
    Effect.gen(function* () {
      const { attributes, element } = makeStatusElement()
      const report = createDomAutoSaveStatusReporter(element)

      yield* report('saving')
      expect(element.textContent).toBe('Saving...')
      expect(element.dataset['saveStatus']).toBe('saving')
      expect(element.title).toBe('Saving world changes')
      expect(attributes).toMatchObject({
        'aria-atomic': 'true',
        'aria-label': 'Saving world changes',
        'aria-live': 'polite',
        role: 'status',
      })

      yield* report('saved')
      expect(element.textContent).toBe('Saved')
      expect(element.dataset['saveStatus']).toBe('saved')
      expect(element.title).toBe('World changes saved')
      expect(attributes['aria-label']).toBe('World changes saved')
      expect(attributes['aria-live']).toBe('polite')

      yield* report('error')
      expect(element.textContent).toBe('Save failed')
      expect(element.dataset['saveStatus']).toBe('error')
      expect(element.title).toBe('Save failed. Use Save & Quit before leaving.')
      expect(attributes['aria-label']).toBe('Save failed. Use Save & Quit before leaving.')
      expect(attributes['aria-live']).toBe('assertive')
    }),
  )

  it.effect('ignores a missing status element', () =>
    Effect.gen(function* () {
      const report = createDomAutoSaveStatusReporter(null)

      yield* report('saving')
      yield* report('saved')
      yield* report('error')
    }),
  )

  it.effect('falls back to status attributes when dataset is unavailable', () =>
    Effect.gen(function* () {
      const attributes: Record<string, string> = {}
      const element = {
        setAttribute: (name: string, value: string) => {
          attributes[name] = value
        },
        textContent: '',
        title: '',
      } as unknown as HTMLElement
      const report = createDomAutoSaveStatusReporter(element)

      yield* report('saved')

      expect(element.textContent).toBe('Saved')
      expect(element.title).toBe('World changes saved')
      expect(attributes['data-save-status']).toBe('saved')
      expect(attributes['aria-label']).toBe('World changes saved')
    }),
  )
})
