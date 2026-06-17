import type { HashMap, MutableRef, Option, Ref } from 'effect'
import type { AttackSwingState } from '@ts-minecraft/presentation'
import type { ResolvedGraphics } from '@ts-minecraft/game'
import type { Chunk } from '@ts-minecraft/world'
import type { DirtyChunkEntry } from '../frame-maintenance-dirty'
import type { CameraPoseSnapshot } from '../frame-camera-pose'
import type { Position } from '@ts-minecraft/core'

export type FrameStageRefs = {
  readonly totalTimeSecsRef: MutableRef.MutableRef<number>
  readonly redstoneTickAccumulatorRef: MutableRef.MutableRef<number>
  readonly fluidTickAccumulatorRef: MutableRef.MutableRef<number>
  readonly healthTickAccumulatorRef: MutableRef.MutableRef<number>
  readonly hungerTickAccumulatorRef: MutableRef.MutableRef<number>
  readonly refractionFrameCounterRef: MutableRef.MutableRef<number>
  readonly refractionValidRef: MutableRef.MutableRef<boolean>
  readonly lastFpsTenthsRef: MutableRef.MutableRef<number>
  readonly lastHealthRef: MutableRef.MutableRef<{ current: number; max: number }>
  readonly lastHungerRef: MutableRef.MutableRef<{ foodLevel: number; max: number }>
  readonly lastXPRef: MutableRef.MutableRef<{ level: number; xpIntoLevel: number; xpRequiredForNext: number }>
  readonly lastArmorRef: MutableRef.MutableRef<{ armorPoints: number }>
  // totalTimeSecs of the player's last melee attack — drives attack-cooldown charge.
  readonly lastPlayerAttackTimeRef: MutableRef.MutableRef<number>
  readonly attackSwingStateRef: MutableRef.MutableRef<AttackSwingState>
  // Accumulated seconds the player has been standing inside a NETHER_PORTAL block.
  // Resets to 0 when the player leaves the portal. Dimension travel fires when this
  // reaches PORTAL_ACTIVATION_SECS (4 seconds — vanilla 80-tick equivalent).
  readonly portalSecsRef: Ref.Ref<number>
  // FR-2 liquid hazards: lava-burn damage accumulator + remaining air supply (secs)
  // + out-of-air drown-damage accumulator.
  readonly lavaDamageSecsRef: MutableRef.MutableRef<number>
  readonly airSecsRef: MutableRef.MutableRef<number>
  readonly drownDamageSecsRef: MutableRef.MutableRef<number>
  readonly suffocationDamageSecsRef: MutableRef.MutableRef<number>
  readonly voidDamageSecsRef: MutableRef.MutableRef<number>
  // Block break progress: tracks currently targeted block key + accumulated ticks + total required.
  readonly breakProgressRef: MutableRef.MutableRef<{ blockKey: string; ticks: number; totalTicks: number } | null>
  // Bow charge: timestamp (totalTimeSecs) when the player started drawing the bow. Null = not charging.
  readonly bowChargeStartRef: MutableRef.MutableRef<number | null>
  // Shield blocking: true while the player is holding right-click with a SHIELD in hand.
  readonly isShieldBlockingRef: MutableRef.MutableRef<boolean>
  // Last displayed air-bubble count (0-10); change-gates the air HUD DOM write.
  readonly lastAirBubblesRef: MutableRef.MutableRef<number>
  readonly lastRenderDistanceRef: MutableRef.MutableRef<number>
  readonly lastEntityStructureVersionRef: Ref.Ref<number>
  readonly entityPhysicsChunkCacheRef: Ref.Ref<Array<Chunk | null>>
  readonly lastEntityPhysicsChunkCoordRef: Ref.Ref<{ readonly cx: number; readonly cz: number }>
  readonly lastEntityPhysicsLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>
  readonly shadowUpdateCounterRef: MutableRef.MutableRef<number>
  readonly frustumThrottleStrideRef: MutableRef.MutableRef<number>
  readonly frustumThrottleCounterRef: MutableRef.MutableRef<number>
  readonly adaptiveQualityCooldownRef: MutableRef.MutableRef<number>
  readonly lastAppliedPixelRatioRef: MutableRef.MutableRef<number>
  readonly lastGraphicsQualityRef: MutableRef.MutableRef<{ quality: number; resolved: ResolvedGraphics }>
  readonly dirtyChunksRef: MutableRef.MutableRef<HashMap.HashMap<string, DirtyChunkEntry>>
  readonly lastLoadedChunksRef: MutableRef.MutableRef<Option.Option<ReadonlyArray<Chunk>>>
  readonly chunkSyncPendingRef: MutableRef.MutableRef<boolean>
  readonly lastShadowTargetRef: MutableRef.MutableRef<{ x: number; z: number }>
  readonly lastFrustumCullRef: MutableRef.MutableRef<CameraPoseSnapshot>
  readonly lastRefractionFrameRef: MutableRef.MutableRef<CameraPoseSnapshot>
  // Pre-allocated scratch buffers for captureCameraPose output-parameter pattern (R89).
  // Written each frame before comparison; avoids a per-frame CameraPoseSnapshot allocation.
  readonly currentFrustumPoseScratch: CameraPoseSnapshot
  readonly currentRefractionPoseScratch: CameraPoseSnapshot
  readonly lastAudioRef: MutableRef.MutableRef<{ enabled: boolean; master: number; sfx: number; music: number }>
  // True if the player was grounded on the PREVIOUS frame — detects the jump instant
  // (wasGrounded && !isGrounded && y-velocity > 0) for jump exhaustion.
  readonly wasGroundedRef: MutableRef.MutableRef<boolean>
  // Horizontal distance accumulated since the last footstep cue.
  readonly footstepDistanceAccumulatorRef: MutableRef.MutableRef<number>
  // Hoisted out of physicsStage so no new Ref is allocated per frame.
  // Reset with Ref.set on entry to physicsStage each frame.
  readonly finalPosRef: Ref.Ref<Position>
  // Per-frame deltaTime written by frameHandler before the pre-built frame
  // pipeline executes. Avoids per-frame Effect.gen closure allocation (P4.1).
  readonly deltaTimeRef: MutableRef.MutableRef<import('@ts-minecraft/core').DeltaTimeSecs>
  // Last settings.dayLengthSeconds value written through to TimeService.
  // Avoids polling TimeService on every input stage frame when the setting is unchanged.
  readonly lastSyncedDayLengthSecondsRef: MutableRef.MutableRef<number>
}
