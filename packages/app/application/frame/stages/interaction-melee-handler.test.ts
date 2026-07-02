import { describe, it } from "@effect/vitest"
import { DEBUG_FEATURE_FLAG_DEFAULTS } from "@ts-minecraft/app/application/debug-feature-flags.config"
import { handleLeftClick } from "@ts-minecraft/app/frame/stages/interaction-melee-handler"
import { createAttackSwingState } from "@ts-minecraft/presentation"
import { ENTITY_CENTER_Y_OFFSET } from "@ts-minecraft/app/frame-handler.config"
import { Effect, HashMap, MutableRef, Option } from "effect"
import { expect, vi } from "vitest"

import { makeDeps } from "../../../test/frame-handler-test-kit/orchestration/deps"
import { makeInputService } from "../../../test/frame-handler-test-kit/presentation/input"
import {
  makeInventoryRenderer,
  makeSettingsOverlay,
} from "../../../test/frame-handler-test-kit/presentation/overlay"
import { makeServices } from "../../../test/frame-handler-test-kit/services"

const makeRefs = (): Parameters<typeof handleLeftClick>[2] => ({
  attackSwingStateRef: MutableRef.make(createAttackSwingState()),
  dirtyChunksRef: MutableRef.make(HashMap.empty()) as Parameters<
    typeof handleLeftClick
  >[2]["dirtyChunksRef"],
  lastPlayerAttackTimeRef: MutableRef.make(-1_000),
  totalTimeSecsRef: MutableRef.make(2.5),
})

describe("handleLeftClick", () => {
  it.effect("plays held item swing animation when no entity is targeted", () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const refs = makeRefs()
      const playEffectSpy = vi.fn(() => Effect.void)
      const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))

      services.soundManager.playEffect = playEffectSpy
      services.entityManager.applyDamage = applyDamageSpy

      yield* handleLeftClick(
        { camera: deps.camera },
        services,
        refs,
        {
          debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS,
          entities: [],
          selectedHotbarItem: Option.none(),
          targetBlock: Option.none(),
          targetHit: Option.none(),
        },
      )

      expect(MutableRef.get(refs.attackSwingStateRef)).toEqual({
        isActive: true,
        triggerTime: 2_500,
      })
      expect(playEffectSpy).not.toHaveBeenCalled()
      expect(applyDamageSpy).not.toHaveBeenCalled()
    }),
  )
})

describe("handleLeftClick host-authority relay", () => {
  const makeAttackHarness = () =>
    Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      // Ray must pass the entity CENTER (position.y + ENTITY_CENTER_Y_OFFSET).
      deps.camera.position.set(0, ENTITY_CENTER_Y_OFFSET, 0)
      deps.camera.getWorldDirection = vi.fn((target) => target.set(0, 0, -1))
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      const applyDamageSpy = vi.fn(() => Effect.succeed(Option.none()))
      const applyKnockbackSpy = vi.fn(() => Effect.void)
      const sendEntityDamage = vi.fn(() => Effect.void)
      ;(services.entityManager as { applyDamage: unknown }).applyDamage = applyDamageSpy
      ;(services.entityManager as { applyKnockback: unknown }).applyKnockback = applyKnockbackSpy
      Object.assign(services, {
        multiplayer: Option.some({ sendEntityDamage } as never),
      })
      return { deps, services, applyDamageSpy, applyKnockbackSpy, sendEntityDamage }
    })

  const attackEntity = (entityId: string) => ({
    entityId,
    position: { x: 0, y: 0, z: -2 },
    velocity: { x: 0, y: 0, z: 0 },
    rotation: {} as never,
    health: 20,
    type: "Zombie",
  })

  it.effect("relays a hit on a remote entity to the entity host with the raw id", () =>
    Effect.gen(function* () {
      const { deps, services, applyDamageSpy, sendEntityDamage } = yield* makeAttackHarness()
      const entity = attackEntity("remote:player-host:entity-42")
      ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([entity]))
      ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))

      yield* handleLeftClick(
        { camera: deps.camera },
        services,
        makeRefs(),
        {
          debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS,
          entities: [entity] as never,
          selectedHotbarItem: Option.none(),
          targetBlock: Option.none(),
          targetHit: Option.none(),
        },
      )

      expect(sendEntityDamage).toHaveBeenCalledTimes(1)
      const [rawId, relayedDamage, impulse] = sendEntityDamage.mock.calls[0] as unknown as [
        string,
        number,
        { x: number; y: number; z: number },
      ]
      expect(rawId).toBe("entity-42")
      // Prediction and relay must agree: the host applies exactly the damage
      // the attacker applied locally.
      expect(applyDamageSpy).toHaveBeenCalledWith(entity.entityId, relayedDamage)
      expect(impulse.y).toBeCloseTo(4.2)
      expect(impulse.z).toBeLessThan(0)
    }),
  )

  it.effect("does not relay hits on locally owned entities", () =>
    Effect.gen(function* () {
      const { deps, services, sendEntityDamage } = yield* makeAttackHarness()
      const entity = attackEntity("entity-7")
      ;(services.entityManager as { getEntities: unknown }).getEntities = vi.fn(() => Effect.succeed([entity]))
      ;(services.entityManager as { getEntity: unknown }).getEntity = vi.fn(() => Effect.succeed(Option.some(entity)))

      yield* handleLeftClick(
        { camera: deps.camera },
        services,
        makeRefs(),
        {
          debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS,
          entities: [entity] as never,
          selectedHotbarItem: Option.none(),
          targetBlock: Option.none(),
          targetHit: Option.none(),
        },
      )

      expect(sendEntityDamage).not.toHaveBeenCalled()
    }),
  )
})
