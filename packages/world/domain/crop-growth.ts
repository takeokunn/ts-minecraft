// Crop growth state machine: age 0 = seedling, 1 = growing, 2 = ripe (harvestable).
// Village / world-generated crops are not tracked — they default to ripe on break so
// the player is rewarded for exploring fields.
export const CROP_MAX_AGE = 2

export const isRipeCrop = (age: number): boolean => age >= CROP_MAX_AGE

export const advanceCropAge = (age: number): number => Math.min(age + 1, CROP_MAX_AGE)

// Seconds between growth ticks (all tracked crops advance by one stage).
// Two ticks to full maturity → 2 minutes total growth time.
export const CROP_GROWTH_INTERVAL_SECS = 60
