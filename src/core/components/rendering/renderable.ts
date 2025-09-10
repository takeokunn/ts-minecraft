import * as S from 'effect/Schema'
import { BlockTypeSchema } from '@/domain/block-types'

/**
 * Renderable Component - Basic rendering information
 */

export const RenderableComponent = S.Struct({
  geometry: S.String,
  blockType: BlockTypeSchema,
})

export type RenderableComponent = S.Schema.Type<typeof RenderableComponent>

/**
 * InstancedMeshRenderable Component - For instanced rendering
 */
export const InstancedMeshRenderableComponent = S.Struct({
  meshType: S.String,
})

export type InstancedMeshRenderableComponent = S.Schema.Type<typeof InstancedMeshRenderableComponent>