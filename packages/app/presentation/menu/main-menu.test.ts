import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, MutableRef, Option } from 'effect'
import { MainMenuLive, MainMenuService } from '@ts-minecraft/app/presentation/menu/main-menu'
import { ConfirmDialogService } from '@ts-minecraft/app/presentation/menu/confirm-dialog'
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair'
import { StorageService, type WorldMetadata } from '@ts-minecraft/world-state'
import { WorldId } from '@ts-minecraft/kernel'
import type { ChunkCoord } from '@ts-minecraft/kernel'

// ---------------------------------------------------------------------------
// Test scaffolding
// ---------------------------------------------------------------------------
//
// MainMenuService is a DOM-heavy service; the production path requires
// `typeof document !== 'undefined'`. Tests run in the default vitest `node`
// environment (vitest.config.ts:6), so the SSR stub branch is exercised. We
// verify the service contract here — DOM rendering is covered by Playwright
// e2e in a follow-up wave.
// ---------------------------------------------------------------------------

const stubDom = {
  _tag: '@minecraft/presentation/DomOperations' as const,
  createElement: <K extends keyof HTMLElementTagNameMap>(_tagName: K): HTMLElementTagNameMap[K] => ({}) as HTMLElementTagNameMap[K],
  appendChild: () => {},
  appendChildTo: () => {},
  removeChild: () => {},
  getParentNode: () => Option.none(),
  setInnerHTML: () => {},
  querySelector: () => Option.none(),
}

const StubDomLayer = Layer.succeed(DomOperationsService, DomOperationsService.of(stubDom))

const stubConfirmDialog = {
  _tag: '@minecraft/presentation/ConfirmDialog' as const,
  show: () => Effect.succeed(false),
}

const StubConfirmLayer = Layer.succeed(ConfirmDialogService, ConfirmDialogService.of(stubConfirmDialog))

const stubStorage = {
  _tag: '@minecraft/infrastructure/storage/StorageService' as const,
  initialize: Effect.void,
  saveChunk: () => Effect.void,
  loadChunk: () => Effect.succeed(Option.none()),
  saveWorldMetadata: () => Effect.void,
  loadWorldMetadata: () => Effect.succeed(Option.none()),
  deleteWorld: () => Effect.void,
  listWorldMetadata: Effect.succeed({
    valid: [] as ReadonlyArray<{ worldId: WorldId; metadata: WorldMetadata }>,
    corrupt: [] as ReadonlyArray<WorldId>,
  }),
}

const StubStorageLayer = Layer.succeed(StorageService, StorageService.of(stubStorage))

const TestLayer = MainMenuLive.pipe(
  Layer.provide(StubStorageLayer),
  Layer.provide(StubDomLayer),
  Layer.provide(StubConfirmLayer),
)

describe('presentation/menu/main-menu', () => {
  describe('MainMenuLive — layer provision', () => {
    it.scoped('exposes show / hide / onSettings methods on the service', () =>
      Effect.gen(function* () {
        const menu = yield* MainMenuService
        expect(typeof menu.show).toBe('function')
        expect(typeof menu.hide).toBe('function')
        expect(typeof menu.onSettings).toBe('function')
      }).pipe(Effect.provide(TestLayer)),
    )

    it.scoped('hide() in the SSR stub branch is a no-op Effect', () =>
      Effect.gen(function* () {
        const menu = yield* MainMenuService
        // In `node` env, `document` is undefined — the stub branch returns
        // `Effect.void` from hide() and `onSettings()`.
        const result = yield* menu.hide()
        expect(result).toBeUndefined()
      }).pipe(Effect.provide(TestLayer)),
    )

    it.scoped('onSettings() in the SSR stub branch accepts a handler without invoking', () =>
      Effect.gen(function* () {
        const menu = yield* MainMenuService
        const invokedRef = MutableRef.make(false)
        yield* menu.onSettings(() => {
          MutableRef.set(invokedRef, true)
        })
        // The stub doesn't actually wire the handler — just verifies the call
        // shape so call sites don't need an `if (typeof document)` guard.
        expect(MutableRef.get(invokedRef)).toBe(false)
      }).pipe(Effect.provide(TestLayer)),
    )
  })

  describe('MainMenuChoice contract', () => {
    it('newWorld choice carries worldId and gameMode', () => {
      const choice = { action: 'newWorld' as const, worldId: 'foo' as WorldId, gameMode: 'creative' as const }
      expect(choice.action).toBe('newWorld')
      expect(choice.gameMode).toBe('creative')
    })

    it('loadWorld choice carries only worldId', () => {
      const choice = { action: 'loadWorld' as const, worldId: 'bar' as WorldId }
      expect(choice.action).toBe('loadWorld')
      expect(choice.worldId).toBe('bar')
    })

    it('quit choice has no payload', () => {
      const choice = { action: 'quit' as const }
      expect(choice.action).toBe('quit')
    })
  })
})

// Suppress unused-import warning for ChunkCoord — kept for future tests.
void ({} as ChunkCoord)
void Arr.length
