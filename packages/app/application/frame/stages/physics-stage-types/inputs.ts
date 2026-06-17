import type { DebugFeatureFlags } from '@ts-minecraft/app/debug-feature-flags'
import type { GameDifficulty } from '@ts-minecraft/game'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'

export type PhysicsStageInputs = {
  readonly deltaTime: DeltaTimeSecs
  readonly initialPlayerPos: Position
  readonly healthValueElementOrNull: HTMLElement | null
  readonly healthMaxElementOrNull: HTMLElement | null
  readonly hungerValueElementOrNull: HTMLElement | null
  readonly hungerMaxElementOrNull: HTMLElement | null
  readonly xpLevelElementOrNull: HTMLElement | null
  readonly xpBarElementOrNull: HTMLElement | null
  readonly xpBarMaxElementOrNull: HTMLElement | null
  readonly armorValueElementOrNull: HTMLElement | null
  readonly airElementOrNull: HTMLElement | null
  readonly debugFlags: DebugFeatureFlags
  readonly difficulty: GameDifficulty
}
