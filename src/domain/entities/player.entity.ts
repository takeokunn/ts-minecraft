import * as S from 'effect/Schema'
import { EntityId } from '@domain/value-objects/entity-id.value-object'
import { Position } from '@domain/value-objects/coordinates/position.value-object'
import { Velocity } from '@domain/value-objects/physics/velocity.value-object'

export const PlayerInventory = S.Array(
  S.Struct({
    slot: S.Number.pipe(S.between(0, 35)),
    itemId: S.String,
    count: S.Number.pipe(S.between(1, 64)),
  }),
)

export const Player = S.Struct({
  _tag: S.Literal('Player'),
  id: EntityId,
  name: S.String,
  position: Position,
  velocity: Velocity,
  health: S.Number.pipe(S.between(0, 20)),
  hunger: S.Number.pipe(S.between(0, 20)),
  experience: S.Number.pipe(S.nonNegative),
  inventory: PlayerInventory,
  gameMode: S.Literal('survival', 'creative', 'adventure', 'spectator'),
})
export type Player = S.Schema.Type<typeof Player>

// Business Logic for Player Entity
export const PlayerBusinessLogic = {
  /**
   * Check if player is alive
   */
  isAlive: (player: Player): boolean => player.health > 0,

  /**
   * Check if player is hungry
   */
  isHungry: (player: Player): boolean => player.hunger < 6,

  /**
   * Check if player is starving
   */
  isStarving: (player: Player): boolean => player.hunger === 0,

  /**
   * Check if player can place blocks (creative mode or has blocks)
   */
  canPlaceBlocks: (player: Player): boolean => {
    if (player.gameMode === 'creative') return true
    // In survival, check if player has blocks in inventory
    return player.inventory.length > 0
  },

  /**
   * Check if player can break blocks
   */
  canBreakBlocks: (player: Player): boolean => {
    return player.gameMode !== 'spectator'
  },

  /**
   * Calculate player's level from experience
   */
  getLevel: (player: Player): number => {
    // Minecraft level formula: level = floor(sqrt(experience))
    return Math.floor(Math.sqrt(player.experience))
  },

  /**
   * Calculate experience needed for next level
   */
  getExperienceToNextLevel: (player: Player): number => {
    const currentLevel = PlayerBusinessLogic.getLevel(player)
    const nextLevelExp = Math.pow(currentLevel + 1, 2)
    return nextLevelExp - player.experience
  },

  /**
   * Check if player has specific item in inventory
   */
  hasItem: (player: Player, itemId: string): boolean => {
    return player.inventory.some((item) => item.itemId === itemId)
  },

  /**
   * Get total count of specific item in inventory
   */
  getItemCount: (player: Player, itemId: string): number => {
    return player.inventory.filter((item) => item.itemId === itemId).reduce((total, item) => total + item.count, 0)
  },

  /**
   * Check if inventory has available slots
   */
  hasInventorySpace: (player: Player): boolean => {
    return player.inventory.length < 36 // Standard Minecraft inventory size
  },

  /**
   * Validate player invariants
   */
  validateInvariants: (player: Player): readonly string[] => {
    const violations: string[] = []

    if (player.health < 0 || player.health > 20) {
      violations.push('Health must be between 0 and 20')
    }

    if (player.hunger < 0 || player.hunger > 20) {
      violations.push('Hunger must be between 0 and 20')
    }

    if (player.experience < 0) {
      violations.push('Experience cannot be negative')
    }

    if (player.inventory.some((item) => item.count <= 0 || item.count > 64)) {
      violations.push('Inventory item counts must be between 1 and 64')
    }

    if (player.inventory.some((item) => item.slot < 0 || item.slot > 35)) {
      violations.push('Inventory slots must be between 0 and 35')
    }

    // Check for duplicate slots
    const slots = player.inventory.map((item) => item.slot)
    const uniqueSlots = new Set(slots)
    if (slots.length !== uniqueSlots.size) {
      violations.push('Inventory cannot have duplicate slots')
    }

    return violations
  },
}

/**
 * Factory function to create a new player with default values
 */
export const createPlayer = (id: EntityId, name: string, position: Position): Player => {
  return S.decodeSync(Player)({
    _tag: 'Player',
    id,
    name,
    position,
    velocity: S.decodeSync(Velocity)({ _tag: 'Velocity', dx: 0, dy: 0, dz: 0 }),
    health: 20,
    hunger: 20,
    experience: 0,
    inventory: [],
    gameMode: 'survival',
  })
}
