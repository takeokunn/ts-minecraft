import { describe, it } from '@effect/vitest'
import { afterEach, expect, vi } from 'vitest'
import { Effect, Layer, Option } from 'effect'

import {
  DAMAGE_OVERLAY_FLASH_MS,
  DamageOverlayService,
} from './damage-overlay'
import { DomOperationsService } from './crosshair'

class TestElement {
  id = ''
  className = ''
  readonly children: TestElement[] = []
  parentElement: TestElement | null = null
  readonly style = { cssText: '' }

  constructor(readonly tagName: string) {}

  appendChild(child: TestElement): TestElement {
    child.parentElement = this
    this.children.push(child)
    return child
  }

  removeChild(child: TestElement): TestElement {
    child.parentElement = null
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    return child
  }
}

const installDom = () => {
  const body = new TestElement('body')
  Reflect.set(globalThis, 'document', {
    body,
    createElement: (tagName: string) => new TestElement(tagName),
  })
  return { body }
}

const domLayer = Layer.succeed(DomOperationsService, {
  createElement: (tagName) => document.createElement(tagName),
  appendChild: (element) => { document.body.appendChild(element) },
  appendChildTo: (parent, child) => { parent.appendChild(child) },
  removeChild: (element) => { element.parentElement?.removeChild(element) },
  getParentNode: (element) => Option.fromNullable(element.parentElement),
  setInnerHTML: (element, html) => {
    element.textContent = html
  },
  querySelector: () => Option.none(),
} as DomOperationsService)

const makeLayer = () =>
  DamageOverlayService.Default.pipe(Layer.provide(domLayer))

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(globalThis, 'document')
})

describe('presentation/hud/damage-overlay', () => {
  it.scoped('creates a hidden overlay in the document body', () => {
    const { body } = installDom()
    return Effect.gen(function* () {
      const overlay = yield* DamageOverlayService
      expect(body.children.includes(overlay.element as unknown as TestElement)).toBe(true)
      expect(overlay.element.id).toBe('damage-overlay')
      expect(overlay.element.className).toBe('damage-overlay')
      expect(overlay.element.style.cssText).toContain('opacity:0')
      expect(overlay.element.style.cssText).toContain('radial-gradient')
    }).pipe(Effect.provide(makeLayer()))
  })

  it('removes overlay DOM when scope closes', async () => {
    const { body } = installDom()
    const state: { element: TestElement | null } = { element: null }

    await Effect.runPromise(
      Effect.gen(function* () {
        const overlay = yield* DamageOverlayService
        state.element = overlay.element as unknown as TestElement
        expect(body.children.includes(state.element)).toBe(true)
      }).pipe(Effect.provide(makeLayer())),
    )

    if (state.element === null) throw new Error('overlay was not captured')
    expect(body.children.includes(state.element)).toBe(false)
  })

  it.scoped('flashes the red vignette and hides it after the timeout', () => {
    vi.useFakeTimers()
    installDom()
    return Effect.gen(function* () {
      const overlay = yield* DamageOverlayService

      yield* overlay.flash()
      expect(overlay.element.style.cssText).toContain('opacity:1')

      vi.advanceTimersByTime(DAMAGE_OVERLAY_FLASH_MS)
      expect(overlay.element.style.cssText).toContain('opacity:0')
    }).pipe(Effect.provide(makeLayer()))
  })

  it.scoped('hide cancels an active flash immediately', () => {
    vi.useFakeTimers()
    installDom()
    return Effect.gen(function* () {
      const overlay = yield* DamageOverlayService

      yield* overlay.flash()
      yield* overlay.hide()

      expect(overlay.element.style.cssText).toContain('opacity:0')
      vi.advanceTimersByTime(DAMAGE_OVERLAY_FLASH_MS)
      expect(overlay.element.style.cssText).toContain('opacity:0')
    }).pipe(Effect.provide(makeLayer()))
  })
})
