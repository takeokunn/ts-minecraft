import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dispatchModBlockBreak,
  dispatchModBlockPlace,
  dispatchModTick,
  getLoadedModNames,
  loadModsFromWindow,
  resetModsForTest,
  type ModContext,
} from './mod-api'

const context: ModContext = {
  giveItem: () => Promise.resolve(true),
  getPlayerPosition: () => Promise.resolve({ x: 0, y: 64, z: 0 }),
  getBlockAt: () => Promise.resolve('STONE'),
  log: () => {},
}

const setWindowMods = (mods: unknown): void => {
  ;(globalThis as { __TS_MINECRAFT_MODS__?: unknown }).__TS_MINECRAFT_MODS__ = mods
}

afterEach(() => {
  resetModsForTest()
  setWindowMods(undefined)
})

describe('mod loading', () => {
  it('loads valid mods, fires onInit with the context, and reports names', () => {
    const onInit = vi.fn()
    setWindowMods([{ name: 'test-mod', version: '1.0.0', onInit }])
    const loaded = loadModsFromWindow(context)
    expect(loaded).toEqual(['test-mod'])
    expect(getLoadedModNames()).toEqual(['test-mod'])
    expect(onInit).toHaveBeenCalledWith(context)
  })

  it('skips invalid registrations (missing name, non-function hooks) without failing the rest', () => {
    const good = { name: 'good', version: '1', onTick: vi.fn() }
    setWindowMods([
      { version: 'nameless' },
      { name: 'bad-hook', version: '1', onTick: 'not-a-function' },
      good,
    ])
    expect(loadModsFromWindow(context)).toEqual(['good'])
  })

  it('no window registration means no mods (and no crash)', () => {
    expect(loadModsFromWindow(context)).toEqual([])
  })
})

describe('event dispatch', () => {
  it('routes block break/place events with their payloads', () => {
    const onBlockBreak = vi.fn()
    const onBlockPlace = vi.fn()
    setWindowMods([{ name: 'events', version: '1', onBlockBreak, onBlockPlace }])
    loadModsFromWindow(context)

    dispatchModBlockBreak({ x: 1, y: 64, z: 2, blockType: 'STONE' })
    expect(onBlockBreak).toHaveBeenCalledWith({ x: 1, y: 64, z: 2, blockType: 'STONE' }, context)

    dispatchModBlockPlace({ x: 3, y: 65, z: 4, blockType: 'DIRT' })
    expect(onBlockPlace).toHaveBeenCalledWith({ x: 3, y: 65, z: 4, blockType: 'DIRT' }, context)
  })

  it('a throwing mod is isolated — later mods still receive the event', () => {
    const explosive = vi.fn(() => {
      throw new Error('mod bug')
    })
    const calm = vi.fn()
    setWindowMods([
      { name: 'explosive', version: '1', onTick: explosive },
      { name: 'calm', version: '1', onTick: calm },
    ])
    loadModsFromWindow(context)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => dispatchModTick()).not.toThrow()
    expect(calm).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('dispatch before load is a silent no-op', () => {
    expect(() => dispatchModBlockBreak({ x: 0, y: 0, z: 0, blockType: 'STONE' })).not.toThrow()
  })
})
