import type { EntityType } from '../mob/entity'
import { AchievementId, type Achievement } from './achievement'

// Curated for the stats this codebase can actually observe today (block-mine,
// mob-kill, craft, dimension-travel — see the four frame-stage hooks that call
// StatisticsService). Not an attempt at vanilla's full advancement tree.
const HOSTILE_MOB_TYPES: ReadonlySet<EntityType> = new Set([
  'Zombie',
  'Skeleton',
  'Spider',
  'Creeper',
  'Enderman',
  'Witch',
  'Drowned',
  'ZombieVillager',
  'Blaze',
  'Ghast',
  'Shulker',
  'Endermite',
  'EnderDragon',
])

const minedAtLeastOne = (blockType: string) => (stats: { readonly blocksMinedByType: Readonly<Partial<Record<string, number>>> }) =>
  (stats.blocksMinedByType[blockType] ?? 0) > 0

const craftedAtLeastOne = (itemType: string) => (stats: { readonly itemsCraftedByType: Readonly<Partial<Record<string, number>>> }) =>
  (stats.itemsCraftedByType[itemType] ?? 0) > 0

const killedAtLeastOne = (mobType: EntityType) => (stats: { readonly mobsKilledByType: Readonly<Partial<Record<EntityType, number>>> }) =>
  (stats.mobsKilledByType[mobType] ?? 0) > 0

export const ACHIEVEMENT_REGISTRY: ReadonlyArray<Achievement> = [
  {
    id: AchievementId.make('getting-wood'),
    name: 'Getting Wood',
    description: 'Mine a wood block.',
    isUnlocked: minedAtLeastOne('WOOD'),
  },
  {
    id: AchievementId.make('benchmarking'),
    name: 'Benchmarking',
    description: 'Craft a crafting table.',
    isUnlocked: craftedAtLeastOne('CRAFTING_TABLE'),
    prerequisite: AchievementId.make('getting-wood'),
  },
  {
    id: AchievementId.make('time-to-mine'),
    name: 'Time to Mine!',
    description: 'Craft a wooden pickaxe.',
    isUnlocked: craftedAtLeastOne('WOODEN_PICKAXE'),
    prerequisite: AchievementId.make('getting-wood'),
  },
  {
    id: AchievementId.make('time-to-strike'),
    name: 'Time to Strike!',
    description: 'Craft a wooden sword.',
    isUnlocked: craftedAtLeastOne('WOODEN_SWORD'),
    prerequisite: AchievementId.make('getting-wood'),
  },
  {
    id: AchievementId.make('hot-topic'),
    name: 'Hot Topic',
    description: 'Craft a furnace.',
    isUnlocked: craftedAtLeastOne('FURNACE'),
    prerequisite: AchievementId.make('benchmarking'),
  },
  {
    id: AchievementId.make('acquire-hardware'),
    name: 'Acquire Hardware',
    description: 'Craft an iron pickaxe.',
    isUnlocked: craftedAtLeastOne('IRON_PICKAXE'),
    prerequisite: AchievementId.make('time-to-mine'),
  },
  {
    id: AchievementId.make('diamonds'),
    name: 'DIAMONDS!',
    description: 'Mine a diamond ore block.',
    isUnlocked: minedAtLeastOne('DIAMOND_ORE'),
    prerequisite: AchievementId.make('acquire-hardware'),
  },
  {
    id: AchievementId.make('cow-tipping'),
    name: 'Cow Tipping',
    description: 'Kill a cow.',
    isUnlocked: killedAtLeastOne('Cow'),
  },
  {
    id: AchievementId.make('monster-hunter'),
    name: 'Monster Hunter',
    description: 'Kill any hostile mob.',
    isUnlocked: (stats) =>
      [...HOSTILE_MOB_TYPES].some((mobType) => (stats.mobsKilledByType[mobType] ?? 0) > 0),
  },
  {
    id: AchievementId.make('we-need-to-go-deeper'),
    name: 'We Need to Go Deeper',
    description: 'Enter the Nether.',
    isUnlocked: (stats) => stats.dimensionsVisited.includes('nether'),
  },
  {
    id: AchievementId.make('the-end'),
    name: 'The End?',
    description: 'Enter the End.',
    isUnlocked: (stats) => stats.dimensionsVisited.includes('end'),
  },
]
