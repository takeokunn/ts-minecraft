import { MetersPerSec } from '@ts-minecraft/core'

// Creative-mode flight vertical speed (blocks/second). Vanilla creative ascends
// /descends at roughly this rate; the branded type enforces the unit and validates
// finiteness at runtime.
export const DEFAULT_FLY_VERTICAL_SPEED: MetersPerSec = MetersPerSec.make(7.5)
