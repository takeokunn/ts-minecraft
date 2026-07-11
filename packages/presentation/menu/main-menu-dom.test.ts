import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Option } from 'effect'
import { WorldId } from '@ts-minecraft/core'
import { DomOperationsService } from '../hud/crosshair'
import { buildMenuDOM, renderCorruptRow, renderValidRow } from './main-menu-dom'
import { menuButtonHoverCss, overlayBaseStyle } from './main-menu-styles'
import type { WorldMetadata } from '@ts-minecraft/world'

type ClickHandler = () => void

type TestElement = HTMLElement & {
  readonly childrenList: TestElement[]
  readonly selectorMatches: Map<string, TestElement>
  readonly clickHandlers: ClickHandler[]
  readonly attributes: Record<string, string>
  readonly focus: ReturnType<typeof vi.fn>
  innerHTML: string
  value: string
  type: string
  setAttribute: (name: string, value: string) => void
  getAttribute: (name: string) => string | null
  click: () => void
}

const asTestElement = (element: HTMLElement): TestElement => element as TestElement

const makeTestElement = <K extends keyof HTMLElementTagNameMap>(_tagName: K): HTMLElementTagNameMap[K] => {
  const childrenList: TestElement[] = []
  const selectorMatches = new Map<string, TestElement>()
  const clickHandlers: ClickHandler[] = []
  const attributes: Record<string, string> = {}
  const element = {
    id: '',
    style: { cssText: '', display: '', background: '', border: '' },
    dataset: {},
    textContent: '',
    innerHTML: '',
    value: '',
    type: '',
    attributes,
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
    setAttribute: (name: string, value: string) => {
      attributes[name] = value
    },
    getAttribute: (name: string) => attributes[name] ?? null,
  }
  return element as unknown as HTMLElementTagNameMap[K]
}

const tagForId = (id: string): keyof HTMLElementTagNameMap => {
  if (id === 'mm-nw-name' || id === 'mm-nw-seed') return 'input'
  if (id === 'mm-mp-server-url') return 'input'
  if (id === 'mm-mp-player-name') return 'input'
  if (id === 'mm-lw-list') return 'div'
  return 'button'
}

const registerInnerHtmlIds = (element: HTMLElement, html: string): void => {
  const parent = asTestElement(element)
  parent.innerHTML = html
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
    expect(elements.overlay.getAttribute('role')).toBe('dialog')
    expect(elements.overlay.getAttribute('aria-modal')).toBe('true')
    expect(elements.overlay.getAttribute('aria-label')).toBe('Main Menu')
    expect(elements.rootCard.id).toBe('main-menu-root')
    expect(elements.rootCard.style.cssText).toContain('100dvh')
    expect(elements.rootCard.style.cssText).toContain('overflow-y:auto')
    expect(elements.newWorldCard.id).toBe('main-menu-new-world')
    expect(elements.newWorldCard.style.cssText).toContain('100dvh')
    expect(elements.loadWorldCard.id).toBe('main-menu-load-world')
    expect(elements.howToPlayCard.id).toBe('main-menu-how-to-play')
    expect(elements.howToPlayCard.style.cssText).toContain('100dvh')
    expect(elements.rootCard.innerHTML).toContain('Pick a world, continue your latest save, or open the controls guide before you start.')
    expect(elements.rootCard.innerHTML).toContain('Keyboard, mouse, and gamepad are supported.')
    expect(elements.rootCard.innerHTML).toContain('Touch controls appear automatically on touch-first devices.')
    expect(elements.rootCard.innerHTML).not.toContain('Touch controls are not available')
    expect(elements.multiplayerCard.id).toBe('main-menu-multiplayer')
    expect(elements.multiplayerCard.style.cssText).toContain('100dvh')
    expect(elements.multiplayerCard.style.cssText).toContain('display:none')
    expect(elements.multiplayerCard.innerHTML).toContain('Join Multiplayer')
    expect(elements.multiplayerCard.innerHTML).toContain('Enter the server address and your player name')
    expect(elements.howToPlayCard.innerHTML).toContain('gamepad')
    expect(elements.howToPlayCard.innerHTML).toContain('left joystick')
    expect(elements.howToPlayCard.innerHTML).not.toContain('Touch controls are not available')
    expect(elements.overlay.style.cssText).toContain('overflow:auto')
    expect(elements.buttons.newWorld.id).toBe('mm-new-world')
    expect(elements.buttons.continueWorld.id).toBe('mm-continue-world')
    expect(elements.buttons.howToPlay.id).toBe('mm-how-to-play')
    expect(elements.buttons.settings.id).toBe('mm-settings')
    expect(elements.buttons.multiplayer.id).toBe('mm-multiplayer')
    expect(elements.buttons.nwSeed.id).toBe('mm-nw-seed')
    expect(elements.buttons.lwList.id).toBe('mm-lw-list')
    expect(elements.buttons.mpServerUrl.id).toBe('mm-mp-server-url')
    expect(elements.buttons.mpPlayerName.id).toBe('mm-mp-player-name')
    expect(elements.buttons.mpCancel.id).toBe('mm-mp-cancel')
    expect(elements.buttons.mpConfirm.id).toBe('mm-mp-confirm')
    expect(elements.buttons.howToPlayClose.id).toBe('mm-how-to-play-close')
    expect(appended).toHaveLength(1)
  })

  it('includes responsive, keyboard-focus, motion, and safe-area styling', () => {
    expect(overlayBaseStyle).toContain('height:100dvh')
    expect(overlayBaseStyle).toContain('env(safe-area-inset-top)')
    expect(menuButtonHoverCss).toContain('@media (max-width:420px)')
    expect(menuButtonHoverCss).toContain(':focus-visible')
    expect(menuButtonHoverCss).toContain('@media (prefers-reduced-motion:reduce)')
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
    const onRename = vi.fn()
    const onDelete = vi.fn()

    renderValidRow(
      dom,
      list,
      WorldId.make('alpha'),
      { ...makeMetadata(), displayName: 'Alpha Base' },
      onLoad,
      onRename,
      onDelete,
    )

    const row = asTestElement(list).childrenList[0]
    if (row === undefined) expect.fail('Expected renderValidRow to append a row')
    const name = row.childrenList[0]?.childrenList[0]
    const loadButton = row.childrenList.find((child) => child.textContent === 'Load')
    const renameButton = row.childrenList.find((child) => child.textContent === 'Rename')
    const deleteButton = row.childrenList.find((child) => child.textContent === 'Delete')
    expect(name?.textContent).toBe('Alpha Base')
    expect(loadButton).toBeDefined()
    expect(renameButton).toBeDefined()
    expect(deleteButton).toBeDefined()
    expect(row.style.cssText).toContain('flex-wrap:wrap')

    loadButton?.click()
    renameButton?.click()
    deleteButton?.click()

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('renders corrupt rows with delete recovery behavior', () => {
    const { dom } = makeDom()
    const list = makeTestElement('div')
    const onDelete = vi.fn()

    renderCorruptRow(dom, list, WorldId.make('broken'), onDelete)

    const row = asTestElement(list).childrenList[0]
    expect(row?.style.cssText).toContain('background:#7a4545')
    const deleteButton = row?.childrenList.find((child) => child.textContent === 'Delete')
    expect(deleteButton).toBeDefined()

    deleteButton?.click()

    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
