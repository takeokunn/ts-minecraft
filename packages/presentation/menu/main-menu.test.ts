import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { MainMenuService } from '@ts-minecraft/presentation/menu/main-menu'
import { ConfirmDialogService } from '@ts-minecraft/presentation/menu/confirm-dialog'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings/settings-overlay'
import { StorageService, type WorldMetadata } from '@ts-minecraft/world'
import { WorldId } from '@ts-minecraft/core'
import type { ChunkCoord } from '@ts-minecraft/core'
import type { MainMenuChoice } from './main-menu-types'

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

const stubSettingsOverlay = {
  _tag: '@minecraft/presentation/SettingsOverlay' as const,
  toggle: () => Effect.succeed(true),
  isOpen: () => Effect.succeed(false),
  syncFromSettings: () => Effect.void,
  applyToSettings: () => Effect.void,
}

const StubSettingsOverlayLayer = Layer.succeed(
  SettingsOverlayService,
  SettingsOverlayService.of(stubSettingsOverlay),
)

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

const TestLayer = MainMenuService.Default.pipe(
  Layer.provide(StubStorageLayer),
  Layer.provide(StubDomLayer),
  Layer.provide(StubConfirmLayer),
  Layer.provide(StubSettingsOverlayLayer),
)

describe('presentation/menu/main-menu', () => {
  describe('MainMenuService.Default — layer provision', () => {
    it.scoped('exposes show / hide methods on the service', () =>
      Effect.gen(function* () {
        const menu = yield* MainMenuService
        expect(typeof menu.show).toBe('function')
        expect(typeof menu.hide).toBe('function')
      }).pipe(Effect.provide(TestLayer)),
    )

    it.scoped('hide() in the SSR stub branch is a no-op Effect', () =>
      Effect.gen(function* () {
        const menu = yield* MainMenuService
        // In `node` env, `document` is undefined — the stub branch returns
        // `Effect.void` from hide().
        const result = yield* menu.hide()
        expect(result).toBeUndefined()
      }).pipe(Effect.provide(TestLayer)),
    )
  })

  describe('MainMenuChoice contract', () => {
    it('newWorld choice can carry worldId, gameMode, and optional seed', () => {
      const choice: MainMenuChoice = {
        action: 'newWorld',
        worldId: 'foo' as WorldId,
        gameMode: 'creative',
        seed: 1234,
      }

      expect(choice.action).toBe('newWorld')
      expect(choice.gameMode).toBe('creative')
      expect(choice.seed).toBe(1234)
    })

    it('loadWorld choice carries only worldId', () => {
      const choice = { action: 'loadWorld' as const, worldId: 'bar' as WorldId }
      expect(choice.action).toBe('loadWorld')
      expect(choice.worldId).toBe('bar')
    })

    it('multiplayer choice carries serverUrl and playerName', () => {
      const choice = {
        action: 'multiplayer' as const,
        serverUrl: 'ws://localhost:8080',
        playerName: 'Alex',
      }
      expect(choice.action).toBe('multiplayer')
      expect(choice.serverUrl).toBe('ws://localhost:8080')
      expect(choice.playerName).toBe('Alex')
    })

  })
})

// Suppress unused-import warning for ChunkCoord — kept for future tests.
void ({} as ChunkCoord)
void Arr.length
