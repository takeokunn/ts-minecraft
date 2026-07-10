import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import {
  makeAchievementService,
  makeSoundManager,
  makeStatisticsService,
} from '../../../test/frame-handler-test-kit/entity'
import { makeAchievementToast } from '../../../test/frame-handler-test-kit/presentation/hud'
import { achievementStage, ACHIEVEMENT_CHECK_INTERVAL_SECS } from './achievement-stage'

const makeStageServices = () => ({
  statisticsService: makeStatisticsService(),
  achievementService: makeAchievementService(),
  achievementToast: makeAchievementToast(),
  soundManager: makeSoundManager(),
})

const FULL_INTERVAL = ACHIEVEMENT_CHECK_INTERVAL_SECS as DeltaTimeSecs

describe('achievementStage', () => {
  it.effect('shows a toast AND plays the unlock chime for each new achievement', () => Effect.gen(function* () {
    const services = makeStageServices()
    ;(services.achievementService as { checkUnlocks: unknown }).checkUnlocks = vi.fn(() =>
      Effect.succeed([
        { id: 'FIRST_BLOCK', name: 'Getting Wood', description: 'Mine a block' },
        { id: 'FIRST_KILL', name: 'Monster Hunter', description: 'Kill a mob' },
      ])
    )
    const showSpy = vi.fn(() => Effect.void)
    ;(services.achievementToast as { show: unknown }).show = showSpy
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    yield* achievementStage(services, MutableRef.make(0), FULL_INTERVAL)

    expect(showSpy).toHaveBeenCalledTimes(2)
    expect(playEffectSpy).toHaveBeenCalledTimes(2)
    expect(playEffectSpy).toHaveBeenCalledWith('achievementUnlock')
  }))

  it.effect('plays no sound when nothing unlocks', () => Effect.gen(function* () {
    const services = makeStageServices()
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    yield* achievementStage(services, MutableRef.make(0), FULL_INTERVAL)

    expect(playEffectSpy).not.toHaveBeenCalled()
  }))

  it.effect('accumulates deltaTime below the check interval without evaluating', () => Effect.gen(function* () {
    const services = makeStageServices()
    const checkUnlocksSpy = vi.fn(() => Effect.succeed([]))
    ;(services.achievementService as { checkUnlocks: unknown }).checkUnlocks = checkUnlocksSpy
    const accumulatorRef = MutableRef.make(0)

    yield* achievementStage(services, accumulatorRef, 0.016 as DeltaTimeSecs)

    expect(checkUnlocksSpy).not.toHaveBeenCalled()
    expect(MutableRef.get(accumulatorRef)).toBeCloseTo(0.016)
  }))
})
