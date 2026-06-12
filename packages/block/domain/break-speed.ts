import { Option } from 'effect'
import { initialBlocks } from './blocks.config'

// Static hardness lookup built once at module load — avoids Effect on the hot path.
const HARDNESS_BY_TYPE: Readonly<Record<string, number>> = Object.fromEntries(
  initialBlocks.map((b) => [b.type as string, b.properties.hardness])
)

export const getBlockHardness = (blockType: string): number => HARDNESS_BY_TYPE[blockType] ?? 0

// Speed multipliers by tool type. Non-listed tools use 1× (no bonus).
const TOOL_SPEED: Readonly<Record<string, number>> = {
  WOODEN_PICKAXE: 2, STONE_PICKAXE: 4, IRON_PICKAXE: 6, DIAMOND_PICKAXE: 8, GOLD_PICKAXE: 2,
  WOODEN_SHOVEL: 2, STONE_SHOVEL: 4, IRON_SHOVEL: 6, DIAMOND_SHOVEL: 8, GOLD_SHOVEL: 2,
  WOODEN_AXE: 2, STONE_AXE: 4, IRON_AXE: 6, DIAMOND_AXE: 8, GOLD_AXE: 2,
}

// Returns game ticks (at 60 fps) required to break a block by holding left-click.
// hardness <= 0 → 0 (instant). Result scales linearly with hardness, reduced by tool tier.
// EFFICIENCY adds level² + 1 to the speed multiplier (vanilla formula).
// tool accepts Option<string> so it is compatible with the wide hotbar-item Option type.
export const computeBreakTicks = (hardness: number, tool: Option.Option<string>, efficiencyLevel?: number): number => {
  if (hardness <= 0) return 0
  const toolStr = Option.getOrNull(tool)
  const baseSpeed = toolStr !== null ? (TOOL_SPEED[toolStr] ?? 1) : 1
  const effBonus = efficiencyLevel !== undefined ? (efficiencyLevel * efficiencyLevel + 1) : 0
  const speedMult = baseSpeed + effBonus
  return Math.ceil((hardness * 3) / speedMult)
}
