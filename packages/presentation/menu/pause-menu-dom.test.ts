import { Option } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { buildPauseMenuDOM } from './pause-menu-dom'

type MockElement = {
  id: string
  textContent: string | null
  innerHTML: string
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

const makeElement = (): MockElement => {
  const element: MockElement = {
    id: '',
    textContent: null,
    innerHTML: '',
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
      if (index >= 0) {
        element.children.splice(index, 1)
      }
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
  const createElement = vi.fn((tagName: keyof HTMLElementTagNameMap) => {
    void tagName
    return makeElement()
  })
  const appendChild = vi.fn((element: HTMLElement): void => {
    roots.push(element as unknown as MockElement)
  })
  const appendChildTo = vi.fn((parent: HTMLElement, child: HTMLElement): void => {
    const mockParent = parent as unknown as MockElement
    const mockChild = child as unknown as MockElement
    mockParent.appendChild(mockChild)
  })
  const removeChild = vi.fn((element: HTMLElement): void => {
    const mock = element as unknown as MockElement
    mock.parentNode?.removeChild(mock)
  })
  const getParentNode = vi.fn((element: HTMLElement) =>
    Option.fromNullable((element as unknown as MockElement).parentElement as unknown as HTMLElement | null),
  )
  const setInnerHTML = vi.fn((element: HTMLElement, html: string): void => {
    const mock = element as unknown as MockElement
    mock.innerHTML = html
  })
  const querySelector = vi.fn(<T extends HTMLElement>(
    _element: HTMLElement,
    _selector: string,
  ) => Option.none<T>())

  return {
    roots,
    createElement,
    appendChild,
    appendChildTo,
    setInnerHTML,
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

describe('buildPauseMenuDOM', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates the How to Play controls and panel in DOM environments', () => {
    vi.stubGlobal('document', {})
    const dom = makeDom()

    const menu = buildPauseMenuDOM(dom.service)

    const panel = Option.getOrNull(menu.panelEl) as unknown as MockElement | null
    const settingsBtn = Option.getOrNull(menu.settingsBtn) as unknown as MockElement | null
    const howToPlayBtn = Option.getOrNull(menu.howToPlayBtn) as unknown as MockElement | null
    const howToPlayPanel = Option.getOrNull(menu.howToPlayPanel) as unknown as MockElement | null
    const howToPlayCloseBtn = Option.getOrNull(menu.howToPlayCloseBtn) as unknown as MockElement | null

    expect(panel?.attributes).toMatchObject({
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Pause Menu',
    })
    expect(panel?.style.cssText).toContain('width:min(420px,calc(100vw - 32px))')
    expect(panel?.style.cssText).toContain('max-height:calc(100vh - 32px)')
    expect(panel?.style.cssText).toContain('overflow-y:auto')
    expect(settingsBtn?.textContent).toBe('Settings')
    expect(settingsBtn?.dataset['role']).toBe('settings')
    expect(howToPlayBtn?.textContent).toBe('How to Play')
    expect(howToPlayBtn?.dataset['role']).toBe('how-to-play')
    expect(howToPlayPanel?.style.cssText).toContain('display:none')
    expect(howToPlayPanel?.attributes).toMatchObject({
      role: 'region',
      'aria-label': 'How to Play',
    })
    expect(howToPlayPanel?.innerHTML).toContain('<strong>Controls:</strong>')
    expect(howToPlayPanel?.innerHTML).toContain('gamepad')
    expect(howToPlayPanel?.innerHTML).toContain('left joystick')
    expect(howToPlayPanel?.innerHTML).not.toContain('Touch controls are not available')
    expect(howToPlayCloseBtn?.textContent).toBe('Close')
    expect(howToPlayCloseBtn?.dataset['role']).toBe('how-to-play-close')
    expect(howToPlayPanel?.children).toContain(howToPlayCloseBtn)
    expect(dom.appendChild).toHaveBeenCalledOnce()
    expect(dom.roots).toEqual([Option.getOrNull(menu.backdropEl)])
  })

  it('returns Option.none handles outside DOM environments', () => {
    vi.stubGlobal('document', undefined)
    const dom = makeDom()

    const menu = buildPauseMenuDOM(dom.service)

    expect(Object.values(menu).every(Option.isNone)).toBe(true)
    expect(dom.createElement).not.toHaveBeenCalled()
    expect(dom.appendChild).not.toHaveBeenCalled()
  })
})
