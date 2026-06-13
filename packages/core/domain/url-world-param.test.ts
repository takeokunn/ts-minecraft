import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest'
import { parseWorldParam, setWorldParam, clearWorldParam } from './url-world-param'

describe('parseWorldParam', () => {
  it('returns worldId when ?world= is present', () => {
    expect(parseWorldParam('?world=my-world')).toBe('my-world')
  })
  it('returns null when no ?world= param', () => {
    expect(parseWorldParam('')).toBeNull()
    expect(parseWorldParam('?debug=perf')).toBeNull()
  })
  it('handles world IDs with generated format', () => {
    expect(parseWorldParam('?world=world-1748000000000-1234')).toBe('world-1748000000000-1234')
  })
  it('handles URL-encoded characters in world ID', () => {
    expect(parseWorldParam('?world=My%20World')).toBe('My World')
  })
  it('returns null for empty world param (?world=)', () => {
    expect(parseWorldParam('?world=')).toBeNull()
  })
  it('is case-sensitive on the key name', () => {
    expect(parseWorldParam('?World=xyz')).toBeNull()
  })
})

describe('setWorldParam', () => {
  const historyMock = { replaceState: vi.fn() }

  beforeEach(() => {
    vi.stubGlobal('history', historyMock)
    historyMock.replaceState.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls history.replaceState with ?world=<id>', () => {
    setWorldParam('my-world')
    expect(historyMock.replaceState).toHaveBeenCalledWith({}, '', '?world=my-world')
  })

  it('encodes special characters so parseWorldParam round-trips correctly', () => {
    setWorldParam('My World')
    const url = historyMock.replaceState.mock.calls[0][2] as string
    expect(parseWorldParam(url)).toBe('My World')
  })

  it('uses replaceState (not pushState)', () => {
    setWorldParam('world-1')
    expect(historyMock.replaceState).toHaveBeenCalledOnce()
  })
})

describe('clearWorldParam', () => {
  const historyMock = { replaceState: vi.fn() }

  beforeEach(() => {
    vi.stubGlobal('history', historyMock)
    historyMock.replaceState.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls history.replaceState with /', () => {
    clearWorldParam()
    expect(historyMock.replaceState).toHaveBeenCalledWith({}, '', '/')
  })
})
