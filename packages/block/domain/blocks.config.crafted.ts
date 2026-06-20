import { Block } from './block'
import { BlockId } from '@ts-minecraft/core'
import { defaultBlockFaces } from './blocks.config.terrain'

const makeBlockId = (id: string) => BlockId.make(id)

export const craftedAndItemBlocks: ReadonlyArray<Block> = [
new Block({
  id: makeBlockId('block:planks'),
  type: 'PLANKS',
  // Vanilla planks 2.0 = wood (35 on this scale), not stone-soft.
  properties: { hardness: 35, transparency: false, solid: true, emissive: false, friction: 0.6 },
  faces: defaultBlockFaces,
}),
  new Block({
    id: makeBlockId('block:oak_stairs'),
    type: 'OAK_STAIRS',
    properties: { hardness: 35, transparency: true, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:crafting_table'),
    type: 'CRAFTING_TABLE',
    properties: { hardness: 40, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:furnace'),
    type: 'FURNACE',
    // Vanilla furnace 3.5 — harder than deepslate (50), far below obsidian (90).
    properties: { hardness: 55, transparency: false, solid: true, emissive: false, friction: 0.8 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:chest'),
    type: 'CHEST',
    properties: { hardness: 35, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:door'),
    type: 'DOOR',
    properties: { hardness: 15, transparency: true, solid: false, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:door_open'),
    type: 'DOOR_OPEN',
    properties: { hardness: 15, transparency: true, solid: false, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:torch'),
    type: 'TORCH',
    properties: { hardness: 1, transparency: true, solid: false, emissive: true, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:netherrack'),
    type: 'NETHERRACK',
    // Vanilla netherrack 0.4 — very soft, mines almost instantly
    properties: { hardness: 5, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:glowstone'),
    type: 'GLOWSTONE',
    // Vanilla glowstone 0.3 — fragile full block that emits maximum light.
    properties: { hardness: 4, transparency: false, solid: true, emissive: true, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:ladder'),
    type: 'LADDER',
    properties: { hardness: 4, transparency: true, solid: false, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:cobweb'),
    type: 'COBWEB',
    // Vanilla cobweb is transparent/pass-through and slows entities heavily.
    properties: { hardness: 4, transparency: true, solid: false, emissive: false, friction: 0.2 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:nether_portal'),
    type: 'NETHER_PORTAL',
    // Portal blocks are non-solid (player walks through) and non-breakable from inventory
    properties: { hardness: 0, transparency: true, solid: false, emissive: true, friction: 0.0 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:fire'),
    type: 'FIRE',
    properties: { hardness: 0, transparency: true, solid: false, emissive: true, friction: 0.0 },
    faces: defaultBlockFaces,
  }),
  // Redstone components (Phase 16)
  new Block({
    id: makeBlockId('block:redstone_wire'),
    type: 'REDSTONE_WIRE',
    // Flat wire — instantly breakable, transparent, non-solid (dust on ground)
    properties: { hardness: 0, transparency: true, solid: false, emissive: false, friction: 0.0 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:redstone_torch'),
    type: 'REDSTONE_TORCH',
    // Like a torch but powered — emits light when active (same hardness as TORCH)
    properties: { hardness: 1, transparency: true, solid: false, emissive: true, friction: 0.1 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:lever'),
    type: 'LEVER',
    properties: { hardness: 5, transparency: true, solid: false, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:stone_button'),
    type: 'STONE_BUTTON',
    properties: { hardness: 5, transparency: true, solid: false, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:pressure_plate'),
    type: 'PRESSURE_PLATE',
    properties: { hardness: 5, transparency: true, solid: false, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:stone_slab'),
    type: 'STONE_SLAB',
    properties: { hardness: 25, transparency: true, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:repeater'),
    type: 'REPEATER',
    properties: { hardness: 35, transparency: true, solid: false, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:bed'),
    type: 'BED',
    // Bed is walkable but not solid — partial-height block; non-solid lets player walk over it.
    properties: { hardness: 10, transparency: true, solid: false, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:enchanting_table'),
    type: 'ENCHANTING_TABLE',
    properties: { hardness: 30, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:anvil'),
    type: 'ANVIL',
    properties: { hardness: 75, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:cauldron'),
    type: 'CAULDRON',
    properties: { hardness: 35, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:water_cauldron'),
    type: 'WATER_CAULDRON',
    properties: { hardness: 35, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:end_stone'),
    type: 'END_STONE',
    properties: { hardness: 45, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:end_portal_frame'),
    type: 'END_PORTAL_FRAME',
    properties: { hardness: 9000, transparency: false, solid: true, emissive: true, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:end_portal'),
    type: 'END_PORTAL',
    // Non-solid/transparent so player can walk into it; emissive gives the eerie glow
    properties: { hardness: 0, transparency: true, solid: false, emissive: true, friction: 0.0 },
    faces: defaultBlockFaces,
  }),
  new Block({
    id: makeBlockId('block:tnt'),
    type: 'TNT',
    // Instantly breakable; red/white striped appearance
    properties: { hardness: 0, transparency: false, solid: true, emissive: false, friction: 0.6 },
    faces: defaultBlockFaces,
  }),
]
