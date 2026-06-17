import { HashSet, Option } from 'effect'
import type { ChunkCoord } from '@ts-minecraft/core'
import { CHUNK_SIZE, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT } from '@ts-minecraft/core'
import type { BlockType, InventoryItem, Position } from '@ts-minecraft/core'
import {
  PICKAXE_REQUIRED_BLOCKS,
  getPickaxeHarvestableBlocks,
  isPickaxeTool,
} from './harvestable-blocks'

// Double-modulo handles negative coordinates correctly.
export const worldToBlockLocal = (
  pos: Position
): { chunkCoord: ChunkCoord; lx: number; lz: number; y: number } => {
  const cx = Math.floor(pos.x / CHUNK_SIZE)
  const cz = Math.floor(pos.z / CHUNK_SIZE)
  const lx = ((Math.floor(pos.x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((Math.floor(pos.z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return { chunkCoord: { x: cx, z: cz }, lx, lz, y: Math.floor(pos.y) }
}

export const canHarvestBlock = (blockType: BlockType, selectedTool: Option.Option<InventoryItem>): boolean => {
  const tool = Option.getOrNull(selectedTool)
  if (tool === null) return !HashSet.has(PICKAXE_REQUIRED_BLOCKS, blockType)
  if (!isPickaxeTool(tool)) return !HashSet.has(PICKAXE_REQUIRED_BLOCKS, blockType)
  return HashSet.has(getPickaxeHarvestableBlocks(tool), blockType)
}

// Block→preferred-tool-category sets, used ONLY to detect a clear CROSS-category mismatch
// for break-speed gating (e.g. a shovel on stone). Deliberately conservative: a block in
// none of these sets is "anyone's" block, so no tool is ever flagged wrong on it.
const AXE_CATEGORY_BLOCKS: HashSet.HashSet<BlockType> = HashSet.fromIterable<BlockType>([
  'WOOD', 'PLANKS', 'CRAFTING_TABLE',
])
const SHOVEL_CATEGORY_BLOCKS: HashSet.HashSet<BlockType> = HashSet.fromIterable<BlockType>([
  'DIRT', 'GRASS', 'SAND', 'GRAVEL', 'FARMLAND', 'SNOW',
])
// The full pickaxe-block set (stone + every ore + obsidian) doubles as the pickaxe category.
const PICKAXE_CATEGORY_BLOCKS = PICKAXE_REQUIRED_BLOCKS

const isAxeTool = (item: InventoryItem): boolean =>
  item === 'WOODEN_AXE' || item === 'STONE_AXE' || item === 'IRON_AXE' || item === 'DIAMOND_AXE' || item === 'GOLD_AXE'
const isShovelTool = (item: InventoryItem): boolean =>
  item === 'WOODEN_SHOVEL' || item === 'STONE_SHOVEL' || item === 'IRON_SHOVEL' || item === 'DIAMOND_SHOVEL' || item === 'GOLD_SHOVEL'

// Whether the held tool grants its speed bonus on this block (distinct from canHarvestBlock,
// which gates DROPS by tool tier). Returns TRUE by default — the bonus is only withheld for a
// clear CROSS-category mismatch (pickaxe on dirt, shovel/axe on stone, etc.). Blocks not in any
// category, bare hands, and non-mining tools keep their current behaviour, so nothing regresses.
export const isEffectiveTool = (blockType: BlockType, selectedTool: Option.Option<InventoryItem>): boolean => {
  const tool = Option.getOrNull(selectedTool)
  if (tool === null) return true // bare hand has no tool bonus anyway; never penalise
  if (isPickaxeTool(tool)) {
    return !HashSet.has(AXE_CATEGORY_BLOCKS, blockType) && !HashSet.has(SHOVEL_CATEGORY_BLOCKS, blockType)
  }
  if (isAxeTool(tool)) {
    return !HashSet.has(PICKAXE_CATEGORY_BLOCKS, blockType) && !HashSet.has(SHOVEL_CATEGORY_BLOCKS, blockType)
  }
  if (isShovelTool(tool)) {
    return !HashSet.has(PICKAXE_CATEGORY_BLOCKS, blockType) && !HashSet.has(AXE_CATEGORY_BLOCKS, blockType)
  }
  return true // non-mining tool (sword/hoe/…): no mining bonus exists, leave as-is
}

// Player AABB centered at (feet.x, feet.y+HALF_HEIGHT, feet.z); block is unit cube centered at (pos+0.5).
export const blockOverlapsPlayer = (blockPos: Position, playerFeetPos: Position): boolean => {
  const playerCenterY = playerFeetPos.y + PLAYER_HALF_HEIGHT
  const blockHalf = 0.5
  return (
    Math.abs(blockPos.x + blockHalf - playerFeetPos.x) < blockHalf + PLAYER_HALF_WIDTH &&
    Math.abs(blockPos.y + blockHalf - playerCenterY) < blockHalf + PLAYER_HALF_HEIGHT &&
    Math.abs(blockPos.z + blockHalf - playerFeetPos.z) < blockHalf + PLAYER_HALF_WIDTH
  )
}
