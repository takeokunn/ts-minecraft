import { describe, it, expect, vi } from 'vitest'
import {
  createDebugLogCapture,
  formatLogArg,
  formatLogArgs,
  MAX_CAPTURED_LOGS,
} from '../application/main/debug-log-capture'

type ErrorListener = (ev: { readonly message?: string; readonly error?: unknown }) => void
type RejectionListener = (ev: { readonly reason?: unknown }) => void

const makeFakeWindow = () => {
  const listeners = new Map<string, ErrorListener | RejectionListener>()
  return {
    addEventListener: ((type: string, listener: ErrorListener | RejectionListener) => {
      listeners.set(type, listener)
    }) as never,
    fire: (type: 'error' | 'unhandledrejection', ev: object) => {
      const listener = listeners.get(type)
      if (listener !== undefined) (listener as (e: object) => void)(ev)
    },
  }
}

describe('formatLogArg', () => {
  it('passes strings through', () => {
    expect(formatLogArg('hello')).toBe('hello')
  })

  it('uses stack for Error instances', () => {
    const err = new Error('boom')
    expect(formatLogArg(err)).toContain('boom')
  })

  it('stringifies plain objects', () => {
    expect(formatLogArg({ a: 1 })).toBe('{"a":1}')
  })

  it('handles circular objects without throwing', () => {
    const obj: Record<string, unknown> = { name: 'x' }
    obj['self'] = obj
    expect(formatLogArg(obj)).toContain('[Circular]')
  })

  it('handles bigint without throwing', () => {
    expect(formatLogArg({ big: 10n })).toContain('10n')
  })

  it('stringifies primitives', () => {
    expect(formatLogArg(42)).toBe('42')
    expect(formatLogArg(null)).toBe('null')
    expect(formatLogArg(undefined)).toBe('undefined')
  })

  it('joins multiple args with spaces', () => {
    expect(formatLogArgs(['a', 1, { b: 2 }])).toBe('a 1 {"b":2}')
  })
})

describe('createDebugLogCapture', () => {
  it('captures console.error and console.warn while still calling the originals', () => {
    const originalError = vi.fn()
    const originalWarn = vi.fn()
    const fakeConsole = { error: originalError, warn: originalWarn }
    const capture = createDebugLogCapture(fakeConsole, null, () => 100)

    fakeConsole.error('bad thing', 42)
    fakeConsole.warn('careful')

    expect(originalError).toHaveBeenCalledWith('bad thing', 42)
    expect(originalWarn).toHaveBeenCalledWith('careful')
    expect(capture.getEntries()).toEqual([
      { timeMs: 100, level: 'error', message: 'bad thing 42' },
      { timeMs: 100, level: 'warn', message: 'careful' },
    ])
  })

  it('captures window error and unhandledrejection events', () => {
    const fakeConsole = { error: vi.fn(), warn: vi.fn() }
    const fakeWindow = makeFakeWindow()
    const capture = createDebugLogCapture(fakeConsole, fakeWindow, () => 5)

    fakeWindow.fire('error', { error: new Error('uncaught!') })
    fakeWindow.fire('unhandledrejection', { reason: 'rejected!' })

    const entries = capture.getEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0]?.level).toBe('uncaught-error')
    expect(entries[0]?.message).toContain('uncaught!')
    expect(entries[1]?.level).toBe('unhandled-rejection')
    expect(entries[1]?.message).toBe('rejected!')
  })

  it('falls back to the event message when error is absent', () => {
    const fakeConsole = { error: vi.fn(), warn: vi.fn() }
    const fakeWindow = makeFakeWindow()
    const capture = createDebugLogCapture(fakeConsole, fakeWindow, () => 5)

    fakeWindow.fire('error', { message: 'script error' })

    expect(capture.getEntries()[0]?.message).toBe('script error')
  })

  it('caps the buffer at MAX_CAPTURED_LOGS, dropping oldest first', () => {
    const fakeConsole = { error: vi.fn(), warn: vi.fn() }
    const capture = createDebugLogCapture(fakeConsole, null, () => 0)

    for (let i = 0; i < MAX_CAPTURED_LOGS + 10; i += 1) {
      fakeConsole.warn(`msg-${i}`)
    }

    const entries = capture.getEntries()
    expect(entries).toHaveLength(MAX_CAPTURED_LOGS)
    expect(entries[0]?.message).toBe('msg-10')
    expect(entries[entries.length - 1]?.message).toBe(`msg-${MAX_CAPTURED_LOGS + 9}`)
  })

  it('clear empties the buffer', () => {
    const fakeConsole = { error: vi.fn(), warn: vi.fn() }
    const capture = createDebugLogCapture(fakeConsole, null, () => 0)
    fakeConsole.error('x')
    capture.clear()
    expect(capture.getEntries()).toEqual([])
  })
})
