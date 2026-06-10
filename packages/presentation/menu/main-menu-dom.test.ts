import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Option } from 'effect'
import { WorldId } from '@ts-minecraft/core'
import { DomOperationsService } from '../hud/crosshair'
import { buildMenuDOM, renderCorruptRow, renderValidRow } from './main-menu-dom'
import type { WorldMetadata } from '@ts-minecraft/world'

type ClickHandler = () => void

type TestElement = HTMLElement & {
  readonly childrenList: TestElement[]
  readonly selectorMatches: Map<string, TestElement>
  readonly clickHandlers: ClickHandler[]
  readonly focus: ReturnType<typeof vi.fn>
  value: string
  type: string
  click: () => void
}

const asTestElement = (element: HTMLElement): TestElement => element as TestElement

const makeTestElement = <K extends keyof HTMLElementTagNameMap>(_tagName: K): HTMLElementTagNameMap[K] => {
  const childrenList: TestElement[] = []
  const selectorMatches = new Map<string, TestElement>()
  const clickHandlers: ClickHandler[] = []
  const element = {
    id: '',
    style: { cssText: '', display: '', background: '', border: '' },
    dataset: {},
    textContent: '',
    value: '',
    type: '',
    focus: vi.fn(),
    childrenList,
    selectorMatches,
    clickHandlers,
    appendChild: (child: Node) => {
      childrenList.push(child as unknown as TestElement)
      return child
    },
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      clickHandlers.push(() => {
        if (typeof listener === 'function') {
          listener(new Event('click'))
          return
        }
        listener.handleEvent(new Event('click'))
      })
    },
    click: () => {
      clickHandlers.forEach((handler) => handler())
    },
  }
  return element as unknown as HTMLElementTagNameMap[K]
}

const tagForId = (id: string): keyof HTMLElementTagNameMap => {
  if (id === 'mm-nw-name') return 'input'
  if (id === 'mm-lw-list') return 'div'
  return 'button'
}

const registerInnerHtmlIds = (element: HTMLElement, html: string): void => {
  const parent = asTestElement(element)
  const idPattern = /id="([^"]+)"/g
  for (const match of html.matchAll(idPattern)) {
    const id = match[1]
    if (id === undefined) continue
    const child = makeTestElement(tagForId(id)) as unknown as TestElement
    child.id = id
    parent.selectorMatches.set(`#${id}`, child)
  }
}

const makeDom = (missingSelector?: string) => {
  const appended: TestElement[] = []
  const dom = DomOperationsService.of({
    _tag: '@minecraft/presentation/DomOperations' as const,
    createElement: makeTestElement,
    appendChild: (element: HTMLElement) => {
      appended.push(asTestElement(element))
    },
    appendChildTo: (parent: HTMLElement, child: HTMLElement) => {
      asTestElement(parent).childrenList.push(asTestElement(child))
    },
    removeChild: () => {},
    getParentNode: () => Option.none(),
    setInnerHTML: registerInnerHtmlIds,
    querySelector: <T extends HTMLElement>(element: HTMLElement, selector: string) => {
      if (selector === missingSelector) return Option.none<T>()
      return Option.fromNullable(asTestElement(element).selectorMatches.get(selector) as T | undefined)
    },
  })
  return { dom, appended }
}

const makeMetadata = (lastPlayed = new Date('2026-05-03T12:00:00.000Z')): WorldMetadata => ({
  seed: 1,
  createdAt: new Date('2026-05-01T12:00:00.000Z'),
  lastPlayed,
  playerSpawn: { x: 0, y: 64, z: 0 },
  gameMode: 'creative',
  saveVersion: 1,
})

describe('presentation/menu/main-menu-dom', () => {
  it('builds the menu DOM and returns required button references', () => {
    const { dom, appended } = makeDom()

    const elements = buildMenuDOM(dom)

    expect(elements.overlay.id).toBe('main-menu-overlay')
    expect(elements.rootCard.id).toBe('main-menu-root')
    expect(elements.newWorldCard.id).toBe('main-menu-new-world')
    expect(elements.loadWorldCard.id).toBe('main-menu-load-world')
    expect(elements.buttons.newWorld.id).toBe('mm-new-world')
    expect(elements.buttons.lwList.id).toBe('mm-lw-list')
    expect(appended).toHaveLength(1)
  })

  it('returns undefined when a required element is missing', () => {
    const { dom } = makeDom('#mm-nw-confirm')

    const result = buildMenuDOM(dom)

    expect(result.buttons.nwConfirm as unknown).toBeUndefined()
  })

  it('renders valid rows with load and delete click behavior', () => {
    const { dom } = makeDom()
    const list = makeTestElement('div')
    const onLoad = vi.fn()
    const onDelete = vi.fn()

    renderValidRow(dom, list, WorldId.make('alpha'), makeMetadata(), onLoad, onDelete)

    const row = asTestElement(list).childrenList[0]
  if (row === undefined) expect.fail('Expected renderValidRow to append a row')
    const loadButton = row.childrenList.find((child) => child.textContent === 'Load')
    const deleteButton = row.childrenList.find((child) => child.textContent === 'Delete')
    expect(loadButton).toBeDefined()
    expect(deleteButton).toBeDefined()

    loadButton?.click()
    deleteButton?.click()

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('renders corrupt rows with delete recovery behavior', () => {
    const { dom } = makeDom()
    const list = makeTestElement('div')
    const onDelete = vi.fn()

    renderCorruptRow(dom, list, WorldId.make('broken'), onDelete)

    const row = asTestElement(list).childrenList[0]
    expect(row?.style.cssText).toContain('background:rgba(140,40,40,0.25)')
    const deleteButton = row?.childrenList.find((child) => child.textContent === 'Delete')
    expect(deleteButton).toBeDefined()

    deleteButton?.click()

    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
