// Hunger tuning constants. Values mirror Minecraft Java Edition mechanics.

export const MAX_FOOD_LEVEL = 20
export const MAX_SATURATION = 20
// Minecraft spawn/respawn state: full food bar, a small saturation reserve.
export const START_FOOD_LEVEL = 20
export const START_SATURATION = 5

// Each whole MAX_EXHAUSTION unit of accumulated exhaustion consumes 1 saturation
// point (or 1 foodLevel when saturation is empty). Vanilla threshold is 4.0.
export const MAX_EXHAUSTION = 4

// The food "tick" fires every FOOD_TICK_INTERVAL game ticks (80 ticks = 4 s at
// 20 t/s) and decides whether the player regenerates health or starves.
export const FOOD_TICK_INTERVAL = 80
// foodLevel at or above this threshold drives natural health regeneration.
export const REGEN_FOOD_THRESHOLD = 18

// Exhaustion costs (Minecraft Java Edition, per action / per block travelled).
export const EXHAUSTION_SPRINT_PER_BLOCK = 0.1
export const EXHAUSTION_JUMP = 0.05
export const EXHAUSTION_SPRINT_JUMP = 0.2
export const EXHAUSTION_ATTACK = 0.1
export const EXHAUSTION_DAMAGE = 0.1
// Natural regeneration is not free: each regenerated HP adds this much exhaustion,
// which is what eventually drains a well-fed player's food bar.
export const EXHAUSTION_PER_REGEN = 6
