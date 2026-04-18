import { HashMap, HashSet, Option } from 'effect'
import type { BlockType } from '@/domain/block'

export const NON_PLACEABLE_BLOCK_TYPES: HashSet.HashSet<BlockType> = HashSet.fromIterable<BlockType>([
  'STICKS',
  'COAL',
  'WOODEN_SWORD',
])

export const INVENTORY_DROP_OVERRIDES: HashMap.HashMap<BlockType, BlockType> = HashMap.fromIterable<BlockType, BlockType>([
  ['STONE', 'COBBLESTONE'],
  ['COAL_ORE', 'COAL'],
])

export const getInventoryDropForBlock = (blockType: BlockType): BlockType =>
  Option.getOrElse(HashMap.get(INVENTORY_DROP_OVERRIDES, blockType), () => blockType)
