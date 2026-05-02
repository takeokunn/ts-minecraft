// Time-of-day thresholds for villager activity scheduling (0.0 = midnight, 0.5 = noon)
export const ACTIVITY_REST_START = 0.78
export const ACTIVITY_REST_END   = 0.22
export const ACTIVITY_WORK_START = 0.28
export const ACTIVITY_WORK_END   = 0.72

// Wander orbit radius in blocks around home position
export const WANDER_RADIUS = 2

// Prime tick multiplier to advance wander phase — avoids axis-aligned movement bias
export const WANDER_PHASE_TICK_STEP = 9
