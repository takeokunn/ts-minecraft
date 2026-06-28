import { describe, it } from "@effect/vitest"
import { DEBUG_FEATURE_FLAG_DEFAULTS } from "@ts-minecraft/app/application/debug-feature-flags.config"
import { handleLeftClick } from "@ts-minecraft/app/frame/stages/interaction-melee-handler"
import { createAttackSwingState } from "@ts-minecraft/presentation"
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
