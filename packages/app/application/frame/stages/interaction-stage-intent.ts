import { Option } from 'effect'
import type { InteractionStageSnapshot } from './interaction-stage-snapshot'

export type InteractionStageIntent = {
  readonly hasRedstoneInput: boolean
  readonly canInteract: boolean
  readonly selectedIsShield: boolean
  readonly selectedIsBow: boolean
  readonly shouldResetBreakProgress: boolean
  readonly shouldResetShieldBlocking: boolean
  readonly shouldFireBowRelease: boolean
  readonly shouldStartBowCharge: boolean
  readonly shouldClearBowCharge: boolean
  readonly shouldBlockWithShield: boolean
}

export const resolveInteractionStageIntent = (
  snapshot: InteractionStageSnapshot,
): InteractionStageIntent => {
  const hasRedstoneInput =
    snapshot.redstoneFlags.placeWire ||
    snapshot.redstoneFlags.placeLever ||
    snapshot.redstoneFlags.placeButton ||
    snapshot.redstoneFlags.placeTorch ||
    snapshot.redstoneFlags.placePiston ||
    snapshot.redstoneFlags.toggleLever ||
    snapshot.redstoneFlags.pressButton ||
    snapshot.redstoneFlags.toggleTorch
  const selectedHotbarItem = Option.getOrNull(snapshot.selectedHotbarItem)
  const selectedIsShield = selectedHotbarItem === 'SHIELD'
  const selectedIsBow = selectedHotbarItem === 'BOW'
  const canInteract =
    !snapshot.paused &&
    !snapshot.isSpectator &&
    (snapshot.leftClick ||
      snapshot.mouseHeld ||
      snapshot.middleClick ||
      snapshot.rightClick ||
      snapshot.rightMouseHeld ||
      hasRedstoneInput)

  return {
    hasRedstoneInput,
    canInteract,
    selectedIsShield,
    selectedIsBow,
    shouldResetBreakProgress: !snapshot.mouseHeld,
    shouldResetShieldBlocking: !snapshot.rightMouseHeld || snapshot.isSpectator,
    shouldFireBowRelease: !snapshot.paused && !snapshot.isSpectator && !snapshot.rightMouseHeld && snapshot.bowChargeStart !== null,
    shouldStartBowCharge: snapshot.rightMouseHeld && selectedIsBow && snapshot.bowChargeStart === null,
    shouldClearBowCharge: !snapshot.rightMouseHeld && !selectedIsBow,
    shouldBlockWithShield: snapshot.rightMouseHeld && selectedIsShield,
  }
}
