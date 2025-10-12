/**
 * @fileoverview Preset Initialization Layer
 *
 * 標準プリセットの初期化Layer
 */

import { Effect, Layer } from 'effect'
import { DEFAULT_TIMESTAMP } from '../../constants'
import { PresetRegistryLive } from './preset_registry_live'
import { PresetRegistryService } from './preset_registry_service'
import type { PresetDefinition } from './presets'

/**
 * 標準プリセット定義
 */

const defaultPreset: PresetDefinition = {
  name: 'Default World',
  description: 'Standard balanced world generation with all features enabled',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'medium',
    memoryUsage: 'medium',
    recommendedThreads: 4,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'balanced',
    maxConcurrentGenerations: 4,
    cacheSize: 1000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'info',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

const survivalPreset: PresetDefinition = {
  name: 'Survival World',
  description: 'Optimized for survival gameplay with enhanced world generation',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'high',
    memoryUsage: 'high',
    recommendedThreads: 2,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'quality',
    maxConcurrentGenerations: 2,
    cacheSize: 2000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'warn',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

const creativePreset: PresetDefinition = {
  name: 'Creative World',
  description: 'Fast generation optimized for creative building',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'low',
    memoryUsage: 'medium',
    recommendedThreads: 8,
  },
  features: {
    structures: true,
    caves: false,
    ores: false,
    villages: true,
    dungeons: false,
  },
  generation: {
    qualityLevel: 'fast',
    maxConcurrentGenerations: 8,
    cacheSize: 1500,
    enableStructures: true,
    enableCaves: false,
    enableOres: false,
    enableDebugMode: false,
    logLevel: 'error',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

const peacefulPreset: PresetDefinition = {
  name: 'Peaceful World',
  description: 'Peaceful world without hostile structures',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'medium',
    memoryUsage: 'medium',
    recommendedThreads: 4,
  },
  features: {
    structures: false,
    caves: true,
    ores: true,
    villages: true,
    dungeons: false,
  },
  generation: {
    qualityLevel: 'balanced',
    maxConcurrentGenerations: 4,
    cacheSize: 1000,
    enableStructures: false,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'info',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

const hardcorePreset: PresetDefinition = {
  name: 'Hardcore World',
  description: 'Maximum quality generation for hardcore gameplay',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'high',
    memoryUsage: 'high',
    recommendedThreads: 1,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'quality',
    maxConcurrentGenerations: 1,
    cacheSize: 3000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'warn',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

const superflatPreset: PresetDefinition = {
  name: 'Superflat World',
  description: 'Flat world with minimal generation',
  category: 'specialized',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: false,
    experimentalFeatures: false,
  },
  performance: {
    cpuUsage: 'low',
    memoryUsage: 'low',
    recommendedThreads: 8,
  },
  features: {
    structures: false,
    caves: false,
    ores: false,
    villages: false,
    dungeons: false,
  },
  generation: {
    qualityLevel: 'fast',
    maxConcurrentGenerations: 16,
    cacheSize: 500,
    enableStructures: false,
    enableCaves: false,
    enableOres: false,
    enableDebugMode: false,
    logLevel: 'error',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

const amplifiedPreset: PresetDefinition = {
  name: 'Amplified World',
  description: 'Extreme terrain generation with amplified features',
  category: 'specialized',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: true,
  },
  performance: {
    cpuUsage: 'high',
    memoryUsage: 'high',
    recommendedThreads: 1,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'quality',
    maxConcurrentGenerations: 1,
    cacheSize: 5000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: false,
    logLevel: 'info',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

const debugPreset: PresetDefinition = {
  name: 'Debug World',
  description: 'Development and debugging focused generation',
  category: 'debug',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: true,
  },
  performance: {
    cpuUsage: 'low',
    memoryUsage: 'medium',
    recommendedThreads: 4,
  },
  features: {
    structures: false,
    caves: false,
    ores: false,
    villages: false,
    dungeons: false,
  },
  generation: {
    qualityLevel: 'fast',
    maxConcurrentGenerations: 4,
    cacheSize: 1000,
    enableStructures: false,
    enableCaves: false,
    enableOres: false,
    enableDebugMode: true,
    logLevel: 'debug',
  },
  metadata: {
    author: 'minecraft-core',
    version: '1.0.0',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

const customPreset: PresetDefinition = {
  name: 'Custom World',
  description: 'User-defined customizable world generation',
  category: 'standard',
  compatibility: {
    minecraftVersion: '1.20+',
    modSupport: true,
    experimentalFeatures: true,
  },
  performance: {
    cpuUsage: 'medium',
    memoryUsage: 'medium',
    recommendedThreads: 4,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {},
  metadata: {
    author: 'user',
    version: '1.0.0',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

const experimentalPreset: PresetDefinition = {
  name: 'Experimental World',
  description: 'Cutting-edge experimental features and generation',
  category: 'experimental',
  compatibility: {
    minecraftVersion: '1.21+',
    modSupport: true,
    experimentalFeatures: true,
  },
  performance: {
    cpuUsage: 'high',
    memoryUsage: 'high',
    recommendedThreads: 2,
  },
  features: {
    structures: true,
    caves: true,
    ores: true,
    villages: true,
    dungeons: true,
  },
  generation: {
    qualityLevel: 'quality',
    maxConcurrentGenerations: 2,
    cacheSize: 2000,
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: true,
    logLevel: 'debug',
  },
  metadata: {
    author: 'minecraft-experimental',
    version: '1.0.0-alpha',
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
}

/**
 * プリセット初期化Layer
 * 全標準プリセットを登録
 */
const PresetInitializationLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const registry = yield* PresetRegistryService

    // 全プリセットを登録
    yield* registry.register('default', defaultPreset)
    yield* registry.register('survival', survivalPreset)
    yield* registry.register('creative', creativePreset)
    yield* registry.register('peaceful', peacefulPreset)
    yield* registry.register('hardcore', hardcorePreset)
    yield* registry.register('superflat', superflatPreset)
    yield* registry.register('amplified', amplifiedPreset)
    yield* registry.register('debug', debugPreset)
    yield* registry.register('custom', customPreset)
    yield* registry.register('experimental', experimentalPreset)
  })
).pipe(Layer.provide(PresetRegistryLive))

/**
 * プリセットシステム統合Layer
 * Registry + 初期化を統合
 */
export const PresetSystemLive = Layer.merge(PresetRegistryLive, PresetInitializationLive)
