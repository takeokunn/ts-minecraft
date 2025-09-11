/**
 * Rendering Component Utilities and Constants
 *
 * Provides utility objects and type definitions for rendering components
 */

import type { MeshComponent, MaterialComponent, LightComponent, CameraComponent, RenderableComponent } from '@domain/entities/components/rendering/rendering-components'

import {
  MeshComponent as MeshComponentSchema,
  MaterialComponent as MaterialComponentSchema,
  LightComponent as LightComponentSchema,
  CameraComponent as CameraComponentSchema,
  RenderableComponent as RenderableComponentSchema,
} from '@domain/entities/components/rendering/rendering-components'

// ===== RENDERING COMPONENT UTILITIES =====

export const RenderingComponents = {
  Mesh: MeshComponentSchema,
  Material: MaterialComponentSchema,
  Light: LightComponentSchema,
  Camera: CameraComponentSchema,
  Renderable: RenderableComponentSchema,
} as const

export type AnyRenderingComponent = MeshComponent | MaterialComponent | LightComponent | CameraComponent | RenderableComponent

// Re-export for backward compatibility
export {
  MeshComponent as MeshComponentType,
  MaterialComponent as MaterialComponentType,
  LightComponent as LightComponentType,
  CameraComponent as CameraComponentType,
  RenderableComponent as RenderableComponentType,
}
