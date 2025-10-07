/**
 * @fileoverview Biome ID Value Object
 * バイオーム識別子の型定義とスキーマ
 */

import { Brand, Schema } from 'effect'

/** バイオームID - Minecraftバイオームの識別子 */
export type BiomeId = string & Brand.Brand<'BiomeId'>

export const BiomeIdSchema = Schema.String.pipe(
  Schema.pattern(/^minecraft:[a-z_]+$/),
  Schema.brand('BiomeId'),
  Schema.annotations({
    title: 'Biome ID',
    description: 'Minecraft biome identifier in namespaced format',
    examples: ['minecraft:plains', 'minecraft:forest', 'minecraft:desert'],
  })
)
