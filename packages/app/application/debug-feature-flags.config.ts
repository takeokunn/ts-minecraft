// Catalog constants and default values for debug feature flags.
// These are static data only — no runtime logic or state.

import type { DebugFeatureCatalogShape, DebugFeatureFlagGroup } from './debug-feature-flags.types'

export const DEBUG_FEATURE_FLAG_CATALOG = [
  {
    id: 'rendering.postProcessing',
    group: 'rendering',
    label: 'Post-processing',
    description: 'Use the fullscreen post-processing composer pipeline.',
    badges: ['reload', 'perf'],
  },
  {
    id: 'rendering.shadows',
    group: 'rendering',
    label: 'Shadows',
    description: 'Render sun shadows for terrain and entities.',
    badges: ['perf'],
  },
  {
    id: 'rendering.sky',
    group: 'rendering',
    label: 'Sky',
    description: 'Render the dynamic sky and time-of-day background.',
    badges: ['perf'],
  },
  {
    id: 'particles.update',
    group: 'particles',
    label: 'Particle updates',
    description: 'Advance particle lifetimes and transforms every frame.',
    badges: ['perf'],
  },
  {
    id: 'particles.spawn',
    group: 'particles',
    label: 'Particle spawning',
    description: 'Spawn block-break particle bursts when blocks are mined.',
    badges: ['perf'],
  },
  {
    id: 'mobs.enabled',
    group: 'mobs',
    label: 'Mobs master',
    description: 'Master kill-switch for mob spawning, updates, rendering, and damage.',
    badges: ['danger'],
  },
  {
    id: 'mobs.spawn',
    group: 'mobs',
    label: 'Mob spawning',
    description: 'Allow ambient mob spawning during maintenance ticks.',
    badges: ['danger'],
  },
  {
    id: 'mobs.ai',
    group: 'mobs',
    label: 'Mob AI',
    description: 'Advance mob behavior and per-frame entity updates.',
    badges: ['danger', 'perf'],
  },
  {
    id: 'mobs.physics',
    group: 'mobs',
    label: 'Mob physics',
    description: 'Apply mob collision resolution and physics movement.',
    badges: ['danger', 'perf'],
  },
  {
    id: 'mobs.render',
    group: 'mobs',
    label: 'Mob rendering',
    description: 'Sync mob scene objects and update their transforms.',
    badges: ['perf'],
  },
  {
    id: 'mobs.damage',
    group: 'mobs',
    label: 'Mob contact damage',
    description: 'Allow hostile mobs to damage the player on contact.',
    badges: ['danger'],
  },
  {
    id: 'simulation.redstone',
    group: 'simulation',
    label: 'Redstone ticks',
    description: 'Advance redstone simulation fixed steps.',
    badges: ['perf'],
  },
  {
    id: 'simulation.fluid',
    group: 'simulation',
    label: 'Fluid ticks',
    description: 'Advance fluid simulation fixed steps.',
    badges: ['perf'],
  },
  {
    id: 'simulation.furnace',
    group: 'simulation',
    label: 'Furnace simulation',
    description: 'Advance furnace progress during maintenance ticks.',
    badges: ['perf'],
  },
  {
    id: 'simulation.village',
    group: 'simulation',
    label: 'Village simulation',
    description: 'Advance villager and village maintenance updates.',
    badges: ['perf'],
  },
  {
    id: 'ui.fps',
    group: 'ui',
    label: 'FPS text',
    description: 'Show the FPS text in the HUD.',
    badges: [],
  },
  {
    id: 'ui.hotbar',
    group: 'ui',
    label: 'Hotbar HUD',
    description: 'Render the hotbar HUD overlay.',
    badges: [],
  },
  {
    id: 'ui.blockHighlight',
    group: 'ui',
    label: 'Block highlight',
    description: 'Show the targeted block highlight outline.',
    badges: [],
  },
  {
    id: 'world.chunkStreaming',
    group: 'world',
    label: 'Chunk streaming',
    description: 'Load and unload chunks around the player during maintenance.',
    badges: ['perf'],
  },
  {
    id: 'world.chunkSceneSync',
    group: 'world',
    label: 'Chunk scene sync',
    description: 'Sync loaded chunks into the active Three.js scene.',
    badges: ['perf'],
  },
  {
    id: 'world.dirtyChunkFlush',
    group: 'world',
    label: 'Dirty chunk flush',
    description: 'Flush per-frame dirty chunk mesh updates into the scene.',
    badges: ['perf'],
  },
] as const satisfies ReadonlyArray<DebugFeatureCatalogShape>

export type DebugFeatureCatalogEntry = (typeof DEBUG_FEATURE_FLAG_CATALOG)[number]
export type DebugFeatureFlagId = DebugFeatureCatalogEntry['id']

export type DebugFeatureFlags = {
  readonly [K in DebugFeatureFlagId]: boolean
}

export type DebugFeatureSnapshot = {
  readonly catalog: ReadonlyArray<DebugFeatureCatalogEntry>
  readonly flags: DebugFeatureFlags
}

export const DEBUG_FEATURE_FLAG_DEFAULTS: DebugFeatureFlags = {
  'rendering.postProcessing': true,
  'rendering.shadows': true,
  'rendering.sky': true,
  'particles.update': true,
  'particles.spawn': true,
  'mobs.enabled': true,
  'mobs.spawn': true,
  'mobs.ai': true,
  'mobs.physics': true,
  'mobs.render': true,
  'mobs.damage': true,
  'simulation.redstone': true,
  'simulation.fluid': true,
  'simulation.furnace': true,
  'simulation.village': true,
  'ui.fps': true,
  'ui.hotbar': true,
  'ui.blockHighlight': true,
  'world.chunkStreaming': true,
  'world.chunkSceneSync': true,
  'world.dirtyChunkFlush': true,
}

export type { DebugFeatureFlagGroup }
