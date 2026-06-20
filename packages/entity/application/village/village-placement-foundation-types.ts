import { type BlockService } from '@ts-minecraft/world'

export type VillageBlockPosition = Parameters<BlockService['forceSetBlock']>[0]
export type VillageBlockType = Parameters<BlockService['forceSetBlock']>[1]

export type VillageBlockPlacement = Readonly<{
  readonly position: VillageBlockPosition
  readonly blockType: VillageBlockType
}>

export type VillageFoundationFootprintCell = Readonly<{
  readonly x: number
  readonly z: number
  readonly surfaceY: number
}>

export type VillagePlacementServicePosition = VillageBlockPosition
export type VillagePlacementServiceBlockType = VillageBlockType
