import * as S from 'effect/Schema'
import { BlockTypeSchema } from '@/domain/block-types'

/**
 * Renderable Component
 * Marks an entity as renderable with specified geometry and material
 */

export const RenderableComponent = S.Struct({
  geometry: S.String, // Geometry identifier
  blockType: BlockTypeSchema,
  visible: S.Boolean.pipe(S.withDefault(() => true)),
  opacity: S.Number.pipe(S.finite(), S.clamp(0, 1)).pipe(S.withDefault(() => 1)),
})

export type RenderableComponent = S.Schema.Type<typeof RenderableComponent>

// Helper to create a renderable component
export const createRenderable = (
  geometry: string,
  blockType: S.Schema.Type<typeof BlockTypeSchema>,
  visible = true,
  opacity = 1
): RenderableComponent => ({
  geometry,
  blockType,
  visible,
  opacity: Math.max(0, Math.min(1, opacity)),
})