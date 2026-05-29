import { it } from '@effect/vitest'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { describe, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 14 — mob vocalizations: a LETHAL player attack plays mobDeath only;
// a SURVIVED attack plays mobHurt only. entityHit (the player's swing cue)
// still fires on every landed hit. Spies are LOCAL vi.fn overrides on the
// per-test services bag — the shared frame-handler-test-kit mock is untouched.
// ---------------------------------------------------------------------------

const ENTITY = {
  entityId: 'entity-1',
  position: { x: 0, y: 64, z: -2 },
  velocity: { x: 0, y: 0, z: 0 },
  rotation: {} as THREE.Quaternion,
  health: 20,
  type: 'Zombie',
}

const arrangeAttack = (applyDamageResult: Option.Option<ReadonlyArray<{ blockType: string; count: number }>>) =>
  Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    deps.camera.position.set(0, 0, 0)
    deps.camera.getWorldDirection = vi.fn((target: THREE.Vector3) => target.set(0, 0, -1))

    const inputService = makeInputService()
    ;(inputService as { consumeMouseClick: unknown }).consumeMouseClick = (btn: number) =>
      Effect.succeed(btn === 0)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.blockHighlight as { getTargetBlock: unknown }).getTargetBlock = vi.fn(() =>
      Effect.succeed(Option.none()),
    )
    ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() =>
      Effect.succeed([ENTITY]),
    )
    ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() =>
      Effect.succeed(Option.some(ENTITY)),
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed(Option.none()),
    )
    // The kill discriminator: Some(drops) on a lethal hit (even empty), None on survive.
    ;(services.entityManager as { applyDamage: unknown }).applyDamage = vi.fn(() =>
      Effect.succeed(applyDamageResult),
    )

    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    return { deps, services, playEffectSpy }
  })

describe('phase 14 — mob vocalization on player attack', () => {
  it.effect('a LETHAL hit (applyDamage → Some, even empty drops) plays mobDeath only, never mobHurt', () =>
    Effect.gen(function* () {
      // Empty drop array on death proves Some-on-empty-drop-kill is the signal.
      const { deps, services, playEffectSpy } = yield* arrangeAttack(Option.some([]))

      yield* runFrame(deps, services)

      expect(playEffectSpy).toHaveBeenCalledWith('mobDeath', { position: ENTITY.position })
      expect(playEffectSpy).not.toHaveBeenCalledWith('mobHurt', expect.anything())
      // Regression guard: the player's swing cue still fires.
      expect(playEffectSpy).toHaveBeenCalledWith('entityHit', { position: ENTITY.position })
    }),
  )

  it.effect('a NON-LETHAL hit (applyDamage → None) plays mobHurt only, never mobDeath', () =>
    Effect.gen(function* () {
      const { deps, services, playEffectSpy } = yield* arrangeAttack(Option.none())

      yield* runFrame(deps, services)

      expect(playEffectSpy).toHaveBeenCalledWith('mobHurt', { position: ENTITY.position })
      expect(playEffectSpy).not.toHaveBeenCalledWith('mobDeath', expect.anything())
      // Regression guard: the player's swing cue still fires.
      expect(playEffectSpy).toHaveBeenCalledWith('entityHit', { position: ENTITY.position })
    }),
  )
})
