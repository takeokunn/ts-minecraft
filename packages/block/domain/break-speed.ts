import { Option } from 'effect'
import type { BlockType, InventoryItem } from '@ts-minecraft/core'
import { initialBlocks } from './blocks.config'

// Static hardness lookup built once at module load — avoids Effect on the hot path.
const HARDNESS_BY_TYPE = Object.fromEntries(
  initialBlocks.map((b): [BlockType, number] => [b.type, b.properties.hardness])
) as Readonly<Record<BlockType, number>>

export const getBlockHardness = (blockType: BlockType): number => HARDNESS_BY_TYPE[blockType]

// Speed multipliers by tool type. Non-listed tools use 1× (no bonus).
const TOOL_SPEED: Readonly<Partial<Record<InventoryItem, number>>> = {
  WOODEN_PICKAXE: 2, STONE_PICKAXE: 4, IRON_PICKAXE: 6, DIAMOND_PICKAXE: 8, GOLD_PICKAXE: 2,
  WOODEN_SHOVEL: 2, STONE_SHOVEL: 4, IRON_SHOVEL: 6, DIAMOND_SHOVEL: 8, GOLD_SHOVEL: 2,
  WOODEN_AXE: 2, STONE_AXE: 4, IRON_AXE: 6, DIAMOND_AXE: 8, GOLD_AXE: 2,
}

export interface BreakTicksInput {
  readonly hardness: number
  readonly tool: Option.Option<InventoryItem>
  readonly efficiencyLevel: number | undefined
  readonly correctTool: boolean
}

// Returns game ticks (at 60 fps) required to break a block by holding left-click.
// hardness <= 0 → 0 (instant). Result scales linearly with hardness, reduced by tool tier.
// EFFICIENCY adds level² + 1 to the speed multiplier (vanilla formula).
export const computeBreakTicks = ({
  hardness,
  tool,
  efficiencyLevel,
  correctTool,
}: BreakTicksInput): number => {
  if (hardness <= 0) return 0
  // A tool only grants its speed multiplier (and Efficiency) when it is the CORRECT
  // category for the block (pickaxe→stone/ore, axe→wood, shovel→dirt). A wrong-category
  // tool breaks at bare-hand speed, matching vanilla where getDestroySpeed returns 1 for
  // an ineffective tool.
  const toolStr = correctTool ? Option.getOrNull(tool) : null
  const baseSpeed = toolStr !== null ? (TOOL_SPEED[toolStr] ?? 1) : 1
  const effBonus = correctTool && efficiencyLevel !== undefined ? (efficiencyLevel * efficiencyLevel + 1) : 0
  const speedMult = baseSpeed + effBonus
  return Math.ceil((hardness * 3) / speedMult)
}
