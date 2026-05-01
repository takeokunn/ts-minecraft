import { describe, it as itEffect } from '@effect/vitest'
import { expect, it, vi } from 'vitest'
import { Effect, Fiber, Layer, Option } from 'effect'
import { ConfirmDialogLive, ConfirmDialogService } from './confirm-dialog'
import { DomOperationsService } from '@/presentation/hud/crosshair'

/**
 * vitest.config.ts uses `environment: 'node'`, so `document` is undefined by
 * default. The dialog returns `false` (cancel) without touching the DOM in
 * that case. Tests that exercise the DOM path stub `document` via
 * `Reflect.set(globalThis, 'document', ...)` so handlers fire deterministically.
 */

type StubElement = HTMLElement & {
  __listeners: Map<string, EventListener[]>
  __focused: boolean
}

const makeStubElement = (): StubElement => {
  const listeners = new Map<string, EventListener[]>()
  const el: Partial<StubElement> = {
    style: { cssText: '' } as CSSStyleDeclaration,
    dataset: {},
    addEventListener: vi.fn((type: string, fn: EventListener) => {
      const list = listeners.get(type) ?? []
      list.push(fn)
      listeners.set(type, list)
    }),
    removeEventListener: vi.fn((type: string, fn: EventListener) => {
      const list = listeners.get(type) ?? []
      const i = list.indexOf(fn)
      if (i >= 0) list.splice(i, 1)
    }),
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    focus: vi.fn(function (this: StubElement) { this.__focused = true }),
    remove: vi.fn(),
  }
  ;(el as StubElement).__listeners = listeners
  ;(el as StubElement).__focused = false
  return el as StubElement
}

const createMockDom = () => {
  const created: StubElement[] = []
  let backdropEl: StubElement | null = null

  const createElement = vi.fn((_tag: string) => {
    const el = makeStubElement()
    created.push(el)
    return el as unknown as HTMLElement
  })

  const appendChild = vi.fn((el: HTMLElement) => {
    backdropEl = el as unknown as StubElement
  })

  const layer = Layer.succeed(DomOperationsService, {
    createElement,
    appendChild,
    appendChildTo: vi.fn(),
    removeChild: vi.fn(),
    getParentNode: vi.fn(() => Option.some({ removeChild: vi.fn() } as unknown as HTMLElement)),
    setInnerHTML: vi.fn(),
    querySelector: vi.fn(() => Option.none()),
  } as unknown as DomOperationsService)

  return {
    layer,
    created,
    get backdropEl(): StubElement | null { return backdropEl },
    createElement,
    appendChild,
  }
}

describe('presentation/menu/confirm-dialog', () => {
  describe('SSR-safe fallback', () => {
    itEffect.scoped('returns false when document is undefined (no DOM environment)', () =>
      Effect.gen(function* () {
        const dialog = yield* ConfirmDialogService
        // In Node test env, document is undefined → short-circuits to false.
        const result = yield* dialog.show('Are you sure?', 'Yes')
        expect(result).toBe(false)
      }).pipe(Effect.provide(ConfirmDialogLive.pipe(Layer.provide(createMockDom().layer))))
    )
  })

  // The earlier `describe.skip` block (P1-W2b) attempted to drive the dialog
  // through forked-fiber + Effect.sleep + simulated click events but hit a
  // fiber-scheduling race where Effect.acquireRelease's `acquire` step (which
  // installs the DOM listeners) ran AFTER the test thread's synthetic click —
  // so the awaited Deferred never resolved. The full DOM-flow integration is
  // now covered by Playwright e2e tests. The unit tests below verify what is
  // both observable AND deterministic without driving event listeners: the
  // synchronous DOM construction phase that runs BEFORE the fiber suspends on
  // `Deferred.await`. Production behavior (click → resolve, Enter/Esc, focus)
  // was manually verified via Playwright MCP.
  describe('DOM construction (with stubbed document)', () => {
    const installStubDocument = () => {
      const docListeners = new Map<string, EventListener[]>()
      const stubDoc = {
        addEventListener: vi.fn((type: string, fn: EventListener) => {
          const list = docListeners.get(type) ?? []
          list.push(fn)
          docListeners.set(type, list)
        }),
        removeEventListener: vi.fn((type: string, fn: EventListener) => {
          const list = docListeners.get(type) ?? []
          const i = list.indexOf(fn)
          if (i >= 0) list.splice(i, 1)
        }),
        activeElement: null as unknown as Element | null,
      }
      Reflect.set(globalThis as object, 'document', stubDoc)
      return {
        docListeners,
        stubDoc,
        cleanup: () => {
          Reflect.deleteProperty(globalThis as object, 'document')
        },
      }
    }

    /**
     * Standard `it` + `Effect.runPromise` is used here (not `itEffect.effect`):
     * the dialog's internal `Effect.scoped` + `Deferred.await` chain, when run
     * inside `@effect/vitest`'s scope, blocks the test's scope-finalization
     * even with `Fiber.interrupt`. Plain `Effect.runPromise` lets us fork,
     * assert on the synchronous construction phase, and interrupt cleanly.
     */
    const runDialogConstruction = (
      message: string,
      confirmLabel: string,
      cancelLabel?: string,
    ) => {
      const stub = installStubDocument()
      const mockDom = createMockDom()
      const program = Effect.gen(function* () {
        const dialog = yield* ConfirmDialogService
        const fiber = yield* Effect.fork(
          cancelLabel === undefined
            ? dialog.show(message, confirmLabel)
            : dialog.show(message, confirmLabel, cancelLabel),
        )
        yield* Effect.sleep('1 millis')
        // Capture state before tearing down.
        const snapshot = {
          createdCount: mockDom.created.length,
          appendChildCalls: mockDom.appendChild.mock.calls.length,
          created: mockDom.created.slice(),
        }
        yield* Fiber.interrupt(fiber)
        return snapshot
      }).pipe(Effect.provide(ConfirmDialogLive.pipe(Layer.provide(mockDom.layer))))
      return Effect.runPromise(program).finally(() => stub.cleanup())
    }

    it('builds confirm + cancel buttons and appends a single root to the document', async () => {
      const snap = await runDialogConstruction('Quit game?', 'Save & Quit')
      // Lookup by data-role rather than count — survives future internal element additions.
      expect(snap.created.find((el) => el.dataset['role'] === 'confirm')).toBeDefined()
      expect(snap.created.find((el) => el.dataset['role'] === 'cancel')).toBeDefined()
      // Exactly one element appended at top level (the backdrop) — invariant: dialog is a single rooted overlay.
      expect(snap.appendChildCalls).toBe(1)
    })

    it('tags the confirm and cancel buttons with data-role attributes for caller introspection', async () => {
      const snap = await runDialogConstruction('Quit?', 'OK')
      const confirmBtn = snap.created.find((el) => el.dataset['role'] === 'confirm')
      const cancelBtn = snap.created.find((el) => el.dataset['role'] === 'cancel')
      expect(confirmBtn).toBeDefined()
      expect(cancelBtn).toBeDefined()
    })

    it('writes the provided confirm and cancel labels to the corresponding buttons', async () => {
      const snap = await runDialogConstruction('Continue?', 'Yes please', 'No thanks')
      const confirmBtn = snap.created.find((el) => el.dataset['role'] === 'confirm')
      const cancelBtn = snap.created.find((el) => el.dataset['role'] === 'cancel')
      expect(confirmBtn?.textContent).toBe('Yes please')
      expect(cancelBtn?.textContent).toBe('No thanks')
    })

    it('defaults the cancel label to "Cancel" when none is provided', async () => {
      const snap = await runDialogConstruction('Quit?', 'OK')
      const cancelBtn = snap.created.find((el) => el.dataset['role'] === 'cancel')
      expect(cancelBtn?.textContent).toBe('Cancel')
    })

    it('writes the message text to the message element and applies role="dialog" + aria-modal to the panel', async () => {
      const snap = await runDialogConstruction('Are you really sure?', 'OK')
      // Locate elements by their construction-time markers, not array index — keeps the test
      // resilient if internal element ordering shifts (e.g., adding a title element).
      const messageEl = snap.created.find((el) => el.textContent === 'Are you really sure?')
      expect(messageEl).toBeDefined()
      const panel = snap.created.find((el) =>
        (el.setAttribute as ReturnType<typeof vi.fn>).mock.calls.some(
          (args: unknown[]) => args[0] === 'role' && args[1] === 'dialog',
        ),
      )
      expect(panel).toBeDefined()
      expect(panel?.setAttribute).toHaveBeenCalledWith('aria-modal', 'true')
    })
  })

  describe('layer wiring', () => {
    itEffect.scoped('exposes ConfirmDialogService with show()', () => {
      const mockDom = createMockDom()
      return Effect.gen(function* () {
        const dialog = yield* ConfirmDialogService
        expect(typeof dialog.show).toBe('function')
      }).pipe(Effect.provide(ConfirmDialogLive.pipe(Layer.provide(mockDom.layer))))
    })
  })
})
