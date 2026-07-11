import { describe, it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { afterEach, expect, vi } from 'vitest'

import {
  ACHIEVEMENT_TOAST_FADE_MS,
  ACHIEVEMENT_TOAST_VISIBLE_MS,
  AchievementToastService,
} from './achievement-toast'
import { DomOperationsService } from './crosshair'

class TestElement {
  id = ''
  textContent = ''
  readonly style = { cssText: '' }
  readonly children: TestElement[] = []
  parentElement: TestElement | null = null

  setAttribute(): void {}

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

const body = new TestElement()
const domLayer = Layer.succeed(DomOperationsService, {
  createElement: () => new TestElement() as unknown as HTMLElement,
  appendChild: (element) => { body.appendChild(element as unknown as TestElement) },
  appendChildTo: (parent, child) => {
    ;(parent as unknown as TestElement).appendChild(child as unknown as TestElement)
  },
  removeChild: (element) => { body.removeChild(element as unknown as TestElement) },
  getParentNode: (element) => Option.fromNullable((element as unknown as TestElement).parentElement) as Option.Option<Node>,
  setInnerHTML: (element, html) => { element.textContent = html },
  querySelector: () => Option.none(),
} as DomOperationsService)

const testLayer = AchievementToastService.Default.pipe(Layer.provide(domLayer))

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  body.children.splice(0)
})

describe('presentation/hud/achievement-toast', () => {
  it.scoped('displays a new toast after the previous queue has fully drained', () => {
    vi.useFakeTimers()

    return Effect.gen(function* () {
      const toast = yield* AchievementToastService
      const toastElement = toast.element as unknown as TestElement
      const nameElement = toastElement.children[1]

      yield* toast.show('First achievement', 'First description')
      expect(nameElement?.textContent).toBe('First achievement')
      expect(toast.element.style.cssText).toContain('opacity:1')

      vi.advanceTimersByTime(ACHIEVEMENT_TOAST_VISIBLE_MS + ACHIEVEMENT_TOAST_FADE_MS)
      expect(toast.element.style.cssText).toContain('opacity:0')

      yield* toast.show('Second achievement', 'Second description')
      expect(nameElement?.textContent).toBe('Second achievement')
      expect(toast.element.style.cssText).toContain('opacity:1')
    }).pipe(Effect.provide(testLayer))
  })
})
