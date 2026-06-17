import { Option } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { FurnaceBlockState, FurnaceItemStack } from './furnace-state'

export type FurnaceSmeltingAdvanceResult = {
  readonly furnace: FurnaceBlockState
  readonly remainingDeltaSecs: number
}

export const advanceFurnaceSmeltingProgress = (
  furnace: FurnaceBlockState,
  deltaTime: DeltaTimeSecs,
  smeltDurationSecs: number,
  output: FurnaceItemStack,
): FurnaceSmeltingAdvanceResult => {
  if (Option.isNone(furnace.activeRecipeId)) {
    return {
      furnace,
      remainingDeltaSecs: deltaTime as number,
    }
  }

  let progressSecs = furnace.progressSecs
  let remainingDeltaSecs = deltaTime as number
  let burnRemainingSecs = furnace.burnRemainingSecs ?? 0
  const burnTotalSecs = furnace.burnTotalSecs
  const fuel = Option.getOrNull(furnace.fuel)

  while (remainingDeltaSecs > 0 && progressSecs < smeltDurationSecs && burnRemainingSecs > 0) {
    const stepSecs = Math.min(remainingDeltaSecs, burnRemainingSecs, smeltDurationSecs - progressSecs)
    progressSecs += stepSecs
    burnRemainingSecs -= stepSecs
    remainingDeltaSecs -= stepSecs
  }

  if (progressSecs < smeltDurationSecs) {
    return {
      furnace: {
        ...furnace,
        fuel: fuel === null ? Option.none() : Option.some(fuel),
        progressSecs,
        burnRemainingSecs,
        burnTotalSecs,
      },
      remainingDeltaSecs,
    }
  }

  return {
    furnace: {
      ...furnace,
      input: Option.none(),
      fuel: Option.none(),
      output: Option.some(output),
      activeRecipeId: Option.none(),
      progressSecs: smeltDurationSecs,
      burnRemainingSecs,
      burnTotalSecs,
    },
    remainingDeltaSecs,
  }
}
