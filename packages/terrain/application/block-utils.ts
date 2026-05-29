import { HashSet, Option } from 'effect'
import type { ChunkCoord } from '@ts-minecraft/kernel'
import { CHUNK_SIZE, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT } from '@ts-minecraft/kernel'
import type { BlockType, ItemType, InventoryItem, Position } from '@ts-minecraft/kernel'
import {
  DIAMOND_PICKAXE_HARVESTABLE_BLOCKS,
  IRON_PICKAXE_HARVESTABLE_BLOCKS,
  STONE_PICKAXE_HARVESTABLE_BLOCKS,
  WOODEN_PICKAXE_HARVESTABLE_BLOCKS,
} from './harvestable-blocks'

// Double-modulo handles negative coordinates correctly.
export const worldToBlockLocal = (
  pos: Position
): { chunkCoord: ChunkCoord; lx: number; lz: number } => {
  const cx = Math.floor(pos.x / CHUNK_SIZE)
  const cz = Math.floor(pos.z / CHUNK_SIZE)
  const lx = ((Math.floor(pos.x) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((Math.floor(pos.z) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  return { chunkCoord: { x: cx, z: cz }, lx, lz }
}

const PICKAXE_HARVEST_SETS = {
  DIAMOND_PICKAXE: DIAMOND_PICKAXE_HARVESTABLE_BLOCKS,
  IRON_PICKAXE: IRON_PICKAXE_HARVESTABLE_BLOCKS,
  STONE_PICKAXE: STONE_PICKAXE_HARVESTABLE_BLOCKS,
  WOODEN_PICKAXE: WOODEN_PICKAXE_HARVESTABLE_BLOCKS,
} satisfies Partial<Record<ItemType, HashSet.HashSet<BlockType>>>

type PickaxeTool = keyof typeof PICKAXE_HARVEST_SETS

const isPickaxeTool = (item: InventoryItem): item is PickaxeTool =>
  item === 'DIAMOND_PICKAXE' ||
  item === 'IRON_PICKAXE' ||
  item === 'STONE_PICKAXE' ||
  item === 'WOODEN_PICKAXE'

// Every block that needs *some* pickaxe to drop = the largest (diamond) tier,
// since the sets are nested (wooden ⊆ stone ⊆ iron ⊆ diamond). A bare hand or a
// non-pickaxe tool drops a block only when it is NOT in this set — using the
// iron set here would wrongly let a hand/sword harvest diamond-only blocks like
// OBSIDIAN (in the diamond set but not the iron set).
const PICKAXE_REQUIRED_BLOCKS = DIAMOND_PICKAXE_HARVESTABLE_BLOCKS

export const canHarvestBlock = (blockType: BlockType, selectedTool: Option.Option<InventoryItem>): boolean =>
  Option.match(selectedTool, {
    onNone: () => !HashSet.has(PICKAXE_REQUIRED_BLOCKS, blockType),
    onSome: (tool) => {
      if (!isPickaxeTool(tool)) return !HashSet.has(PICKAXE_REQUIRED_BLOCKS, blockType)
      return HashSet.has(PICKAXE_HARVEST_SETS[tool], blockType)
    },
  })

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
