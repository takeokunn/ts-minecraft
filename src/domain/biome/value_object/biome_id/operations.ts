/**
 * @fileoverview Biome ID Operations
 * BiomeId操作関数
 */

import { Schema } from 'effect'
import { BiomeId, BiomeIdSchema } from './schema'

/** BiomeId作成ヘルパー */
export const createBiomeId = (id: string): BiomeId => Schema.decodeSync(BiomeIdSchema)(id)
