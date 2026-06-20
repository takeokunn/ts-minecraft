// Combat data tables and constants. Keep this file free of logic so callers can
// import stable combat values without pulling in the resolution helpers.

// ─── Mob combat categories ────────────────────────────────────────────────────
// Vanilla enchantment targeting is mob-category based, not mob-type based.
// Keeping these sets here (entity domain) avoids leaking mob knowledge into
// the application / presentation layer.

export const UNDEAD_MOB_TYPES = new Set(['Zombie', 'Skeleton', 'Drowned', 'ZombieVillager'])
export const ARTHROPOD_MOB_TYPES = new Set(['Spider'])

export const CRITICAL_DAMAGE_MULTIPLIER = 1.5

// Each armor point reduces incoming damage by 4%, capped at 20 points (80%).
export const ARMOR_REDUCTION_PER_POINT = 0.04
export const MAX_ARMOR_POINTS = 20

// ─── Attack cooldown (Minecraft 1.9 charged-attack model) ───────────────────
// After an attack the weapon recharges over DEFAULT_ATTACK_COOLDOWN_SECS. Hitting
// again before fully charged weakens the blow, discouraging spam-clicking.

export const DEFAULT_ATTACK_COOLDOWN_SECS = 0.625 // ~1.6 attacks/sec (vanilla sword)

// ─── Weapon base damage (vanilla Java Edition 1.9+) ──────────────────────────

export const PLAYER_ATTACK_DAMAGE = 4
export const WOODEN_SWORD_ATTACK_DAMAGE = 8
export const GOLD_SWORD_ATTACK_DAMAGE = 8 // gold = wooden tier (R99)
export const STONE_SWORD_ATTACK_DAMAGE = 9
export const IRON_SWORD_ATTACK_DAMAGE = 12
export const DIAMOND_SWORD_ATTACK_DAMAGE = 16
export const WOODEN_AXE_ATTACK_DAMAGE = 9
export const GOLD_AXE_ATTACK_DAMAGE = 9 // gold = wooden tier (R99)
export const STONE_AXE_ATTACK_DAMAGE = 10
export const IRON_AXE_ATTACK_DAMAGE = 11
export const DIAMOND_AXE_ATTACK_DAMAGE = 13

export const WEAPON_BASE_DAMAGE: Readonly<Record<string, number>> = {
  WOODEN_SWORD: WOODEN_SWORD_ATTACK_DAMAGE,
  GOLD_SWORD: GOLD_SWORD_ATTACK_DAMAGE,
  STONE_SWORD: STONE_SWORD_ATTACK_DAMAGE,
  IRON_SWORD: IRON_SWORD_ATTACK_DAMAGE,
  DIAMOND_SWORD: DIAMOND_SWORD_ATTACK_DAMAGE,
  WOODEN_AXE: WOODEN_AXE_ATTACK_DAMAGE,
  GOLD_AXE: GOLD_AXE_ATTACK_DAMAGE,
  STONE_AXE: STONE_AXE_ATTACK_DAMAGE,
  IRON_AXE: IRON_AXE_ATTACK_DAMAGE,
  DIAMOND_AXE: DIAMOND_AXE_ATTACK_DAMAGE,
}

// ─── Knockback ────────────────────────────────────────────────────────────────
// A hit shoves the target away from the attacker (horizontal) and pops it up a
// little (vertical). Velocities are in blocks/sec, comparable to mob speed (~1)
// and jump velocity (~4.2). The impulse rides for KNOCKBACK_DURATION_SECS before
// mob AI reclaims horizontal velocity (see EntityManager.update).

export const KNOCKBACK_HORIZONTAL_SPEED = 5
export const KNOCKBACK_VERTICAL_SPEED = 4.2
// Sprint-hit knockback behaves like one extra horizontal knockback level in this model.
export const SPRINT_ATTACK_KNOCKBACK_MULTIPLIER_BONUS = 0.5
// 6 game ticks @ 20 ticks/s. Stored in SECONDS (not a frame count) and decremented by
// deltaTime so the knockback lasts the same real 0.3s regardless of frame rate.
export const KNOCKBACK_DURATION_SECS = 0.3
