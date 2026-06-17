import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import type { InteractionStageSnapshot } from './interaction-stage-snapshot'
import type { RedstoneFlags } from './interaction-redstone-handler'

export type InteractionStageSnapshotPausedContext = {
  readonly totalTimeSecs: number
}

export type InteractionStageSnapshotActiveContext = {
  readonly leftClick: boolean
  readonly mouseHeld: boolean
  readonly middleClick: boolean
  readonly rightClick: boolean
  readonly rightMouseHeld: boolean
  readonly redstoneFlags: RedstoneFlags
  readonly unequipArmor: boolean
  readonly isSpectator: boolean
  readonly isCreative: boolean
  readonly selectedHotbarItem: Option.Option<InventoryItem>
  readonly breakProgressElementOrNull: HTMLElement | null
  readonly bowChargeStart: number | null
  readonly totalTimeSecs: number
}

export const createInteractionStageRedstoneFlags = (
  overrides: Partial<RedstoneFlags> = {},
): RedstoneFlags => ({
  placeWire: false,
  placeLever: false,
  placeButton: false,
  placeTorch: false,
  placePiston: false,
  toggleLever: false,
  pressButton: false,
  toggleTorch: false,
  ...overrides,
})

export const createPausedInteractionStageSnapshot = (
  context: InteractionStageSnapshotPausedContext,
): InteractionStageSnapshot => ({
  paused: true,
  leftClick: false,
  mouseHeld: false,
  middleClick: false,
  rightClick: false,
  rightMouseHeld: false,
  redstoneFlags: createInteractionStageRedstoneFlags(),
  unequipArmor: false,
  isSpectator: false,
  isCreative: false,
  selectedHotbarItem: Option.none(),
  breakProgressElementOrNull: null,
  bowChargeStart: null,
  totalTimeSecs: context.totalTimeSecs,
})

export const createActiveInteractionStageSnapshot = (
  context: InteractionStageSnapshotActiveContext,
): InteractionStageSnapshot => ({
  paused: false,
  leftClick: context.leftClick,
  mouseHeld: context.mouseHeld,
  middleClick: context.middleClick,
  rightClick: context.rightClick,
  rightMouseHeld: context.rightMouseHeld,
  redstoneFlags: context.redstoneFlags,
  unequipArmor: context.unequipArmor,
  isSpectator: context.isSpectator,
  isCreative: context.isCreative,
  selectedHotbarItem: context.selectedHotbarItem,
  breakProgressElementOrNull: context.breakProgressElementOrNull,
  bowChargeStart: context.bowChargeStart,
  totalTimeSecs: context.totalTimeSecs,
})
