import type { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import type { MobLimbGroup } from './mob-geometry.core'
import {
  buildBat,
  buildBiped,
  buildBlaze,
  buildChicken,
  buildQuadruped,
  buildShulker,
  buildSquid,
} from './mob-geometry.builders.shapes'
import {
  BAT_PALETTE,
  BAT_PARTS,
  BEE_PALETTE,
  BEE_PARTS,
  BLAZE_PALETTE,
  BLAZE_PARTS,
  CHICKEN_PALETTE,
  CHICKEN_PARTS,
  COW_PALETTE,
  COW_PARTS,
  CREEPER_PALETTE,
  CREEPER_PARTS,
  DRAGON_PALETTE,
  DRAGON_PARTS,
  DROWNED_PALETTE,
  DROWNED_PARTS,
  ENDERMAN_PALETTE,
  ENDERMAN_PARTS,
  ENDERMITE_PALETTE,
  ENDERMITE_PARTS,
  GLOW_SQUID_PALETTE,
  GHAST_PARTS,
  GHAST_PALETTE,
  PIG_PALETTE,
  PIG_PARTS,
  SHEEP_PALETTE,
  SHEEP_PARTS,
  SHULKER_PALETTE,
  SHULKER_PARTS,
  SKELETON_PALETTE,
  SKELETON_PARTS,
  SPIDER_PALETTE,
  SPIDER_PARTS,
  SQUID_PALETTE,
  SQUID_PARTS,
  WITCH_PALETTE,
  WITCH_PARTS,
  ZOMBIE_PALETTE,
  ZOMBIE_PARTS,
  ZOMBIE_VILLAGER_PALETTE,
  VILLAGER_PALETTE,
  ZOMBIE_VILLAGER_PARTS,
  VILLAGER_PARTS,
} from './mob-geometry.parts'

// Routes each mob type to its body-plan builder (see mob-geometry.builders.shapes.ts)
// with the type's part dimensions + palette. Adding a mob = one case here plus its
// PARTS/PALETTE entry; the shape itself is reused across mobs that share a body plan.
export const buildMobGroup = (type: EntityType): MobLimbGroup => {
  switch (type) {
    case 'Zombie':
      return buildBiped('Zombie', ZOMBIE_PARTS, ZOMBIE_PALETTE)
    case 'Cow':
      return buildQuadruped('Cow', COW_PARTS, COW_PALETTE)
    case 'Pig':
      return buildQuadruped('Pig', PIG_PARTS, PIG_PALETTE)
    case 'Sheep':
      return buildQuadruped('Sheep', SHEEP_PARTS, SHEEP_PALETTE)
    case 'Chicken':
      return buildChicken('Chicken', CHICKEN_PARTS, CHICKEN_PALETTE)
    case 'Bat':
      return buildBat('Bat', BAT_PARTS, BAT_PALETTE)
    case 'Bee':
      return buildBat('Bee', BEE_PARTS, BEE_PALETTE)
    case 'Squid':
      return buildSquid('Squid', SQUID_PARTS, SQUID_PALETTE)
    case 'GlowSquid':
      return buildSquid('GlowSquid', SQUID_PARTS, GLOW_SQUID_PALETTE)
    case 'Ghast':
      return buildSquid('Ghast', GHAST_PARTS, GHAST_PALETTE)
    case 'Witch':
      return buildBiped('Witch', WITCH_PARTS, WITCH_PALETTE)
    case 'Drowned':
      return buildBiped('Drowned', DROWNED_PARTS, DROWNED_PALETTE)
    case 'ZombieVillager':
      return buildBiped('ZombieVillager', ZOMBIE_VILLAGER_PARTS, ZOMBIE_VILLAGER_PALETTE)
    case 'Villager':
      return buildBiped('Villager', VILLAGER_PARTS, VILLAGER_PALETTE)
    case 'Creeper':
      return buildQuadruped('Creeper', CREEPER_PARTS, CREEPER_PALETTE)
    case 'Skeleton':
      return buildBiped('Skeleton', SKELETON_PARTS, SKELETON_PALETTE)
    case 'Spider':
      return buildQuadruped('Spider', SPIDER_PARTS, SPIDER_PALETTE)
    case 'Enderman':
      return buildBiped('Enderman', ENDERMAN_PARTS, ENDERMAN_PALETTE)
    case 'EnderDragon':
      return buildBiped('EnderDragon', DRAGON_PARTS, DRAGON_PALETTE)
    case 'Endermite':
      return buildQuadruped('Endermite', ENDERMITE_PARTS, ENDERMITE_PALETTE)
    case 'Shulker':
      return buildShulker('Shulker', SHULKER_PARTS, SHULKER_PALETTE)
    case 'Blaze':
      return buildBlaze('Blaze', BLAZE_PARTS, BLAZE_PALETTE)
  }
}
