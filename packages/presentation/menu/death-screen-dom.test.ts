import { Option } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { buildDeathScreenDOM } from './death-screen-dom'

type MockElement = {
  id: string
  tagName: string
  textContent: string | null
  readonly style: { cssText: string }
  readonly dataset: Record<string, string>
  readonly children: MockElement[]
  parentNode: MockElement | null
  parentElement: MockElement | null
  readonly attributes: Record<string, string>
  appendChild: (child: MockElement) => MockElement
  removeChild: (child: MockElement) => MockElement
  setAttribute: (name: string, value: string) => void
}

const makeElement = (tagName: string): MockElement => {
  const element: MockElement = {
    id: '',
    tagName,
    textContent: null,
    style: { cssText: '' },
    dataset: {},
    children: [],
    parentNode: null,
    parentElement: null,
    attributes: {},
    appendChild: (child) => {
      child.parentNode = element
      child.parentElement = element
      element.children.push(child)
      return child
    },
    removeChild: (child) => {
      const index = element.children.indexOf(child)
      if (index >= 0) element.children.splice(index, 1)
      child.parentNode = null
      child.parentElement = null
      return child
    },
    setAttribute: (name, value) => {
      element.attributes[name] = value
    },
  }
  return element
}

const makeDom = () => {
  const roots: MockElement[] = []
  const created: MockElement[] = []
  const createElement = vi.fn((tagName: string) => {
    const element = makeElement(tagName)
    created.push(element)
    return element as unknown as HTMLElement
  })
  const appendChild = vi.fn((element: HTMLElement) => {
    roots.push(element as unknown as MockElement)
  })
  const appendChildTo = vi.fn((parent: HTMLElement, child: HTMLElement) => {
    (parent as unknown as MockElement).appendChild(child as unknown as MockElement)
  })
  const removeChild = vi.fn((element: HTMLElement) => {
    const mock = element as unknown as MockElement
    mock.parentNode?.removeChild(mock)
  })
  const getParentNode = vi.fn((element: HTMLElement) =>
    Option.fromNullable((element as unknown as MockElement).parentElement as unknown as HTMLElement | null),
  )
  const setInnerHTML = vi.fn((element: HTMLElement, html: string) => {
    void element
    void html
  })
  const querySelector = vi.fn(<T extends HTMLElement>() => Option.none<T>())

  return {
    roots,
    created,
    createElement,
    appendChild,
    service: DomOperationsService.of({
      _tag: '@minecraft/presentation/DomOperations' as const,
      createElement: createElement as unknown as DomOperationsService['createElement'],
      appendChild,
      appendChildTo,
      removeChild,
      getParentNode,
      setInnerHTML,
      querySelector: querySelector as DomOperationsService['querySelector'],
    }),
  }
}

describe('buildDeathScreenDOM', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns Option.none handles outside DOM environments', () => {
    vi.stubGlobal('document', undefined)
    const dom = makeDom()

    const result = buildDeathScreenDOM(dom.service)

    expect(Object.values(result).every(Option.isNone)).toBe(true)
    expect(dom.createElement).not.toHaveBeenCalled()
    expect(dom.appendChild).not.toHaveBeenCalled()
  })

  it('builds the death screen panel and appends a single backdrop root', () => {
    vi.stubGlobal('document', {})
    const dom = makeDom()

    const result = buildDeathScreenDOM(dom.service)

    const backdrop = Option.getOrNull(result.backdropEl) as MockElement | null
    const respawnBtn = Option.getOrNull(result.respawnBtn) as MockElement | null
    const quitBtn = Option.getOrNull(result.quitBtn) as MockElement | null
    const panel = backdrop?.children[0] ?? null
    const title = panel?.children[0] ?? null
    const message = panel?.children[1] ?? null
    const help = panel?.children[2] ?? null

    expect(backdrop?.id).toBe('death-screen-backdrop')
    expect(backdrop?.children).toHaveLength(1)
    expect(panel?.attributes).toMatchObject({
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'death-screen-title',
      'aria-describedby': 'death-screen-message death-screen-help',
    })
    expect(title?.id).toBe('death-screen-title')
    expect(title?.textContent).toBe('YOU DIED')
    expect(message?.id).toBe('death-screen-message')
    expect(message?.textContent).toBe('You died.')
    expect(message?.dataset['role']).toBe('death-message')
    expect(message?.attributes['aria-live']).toBe('polite')
    expect(help?.id).toBe('death-screen-help')
    expect(help?.textContent).toContain('Press Enter or Esc to respawn')
    expect(respawnBtn?.textContent).toBe('Respawn')
    expect(respawnBtn?.dataset['role']).toBe('respawn')
    expect(respawnBtn?.attributes['aria-label']).toBe('Respawn at your current spawn point')
    expect(quitBtn?.textContent).toBe('Quit to Title')
    expect(quitBtn?.dataset['role']).toBe('quit-to-title')
    expect(quitBtn?.attributes['aria-label']).toBe('Quit to title screen')
    expect(panel?.children).toEqual([title, message, help, respawnBtn, quitBtn])
    expect(dom.appendChild).toHaveBeenCalledOnce()
    expect(dom.roots).toEqual([backdrop])
  })
})
