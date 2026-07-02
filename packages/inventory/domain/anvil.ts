// Anvil repair (v1): right-clicking an anvil with a damaged durable item
// restores it to full durability for an XP-level cost proportional to the
// missing durability. Vanilla's material/combine mechanics are a later
// fidelity step; the XP cost keeps repair meaningfully gated.

export const ANVIL_REPAIR_MAX_COST_LEVELS = 5

// XP levels to fully repair: 1..MAX scaled by the missing fraction; 0 when
// the item is already at full durability (no-op).
export const anvilRepairCostLevels = (durability: number, maxDurability: number): number => {
  if (maxDurability <= 0) return 0
  const missing = Math.max(0, maxDurability - durability)
  if (missing === 0) return 0
  return Math.min(
    ANVIL_REPAIR_MAX_COST_LEVELS,
    Math.max(1, Math.ceil((missing / maxDurability) * ANVIL_REPAIR_MAX_COST_LEVELS)),
  )
}
