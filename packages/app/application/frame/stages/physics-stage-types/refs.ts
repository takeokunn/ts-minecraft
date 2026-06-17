import type { FrameStageRefs } from '@ts-minecraft/app/frame/types'

export type PhysicsStageRefs = Pick<FrameStageRefs, 'lastHealthRef' | 'lastHungerRef' | 'lastXPRef' | 'lastArmorRef' | 'portalSecsRef' | 'dirtyChunksRef' | 'lavaDamageSecsRef' | 'airSecsRef' | 'drownDamageSecsRef' | 'suffocationDamageSecsRef' | 'voidDamageSecsRef' | 'lastAirBubblesRef' | 'isShieldBlockingRef' | 'wasGroundedRef' | 'footstepDistanceAccumulatorRef' | 'finalPosRef' | 'healthTickAccumulatorRef' | 'hungerTickAccumulatorRef' | 'entityPhysicsChunkCacheRef' | 'lastEntityPhysicsChunkCoordRef'>
