/**
 * Rendering Component Factory Functions
 *
 * Provides factory functions for creating rendering components with sensible defaults
 */

import * as Data from 'effect/Data'
import type {
  MeshComponent,
  MaterialComponent,
  LightComponent,
  CameraComponent,
  RenderableComponent,
  MeshGeometry,
} from '@domain/entities/components/rendering/rendering-components'

// ===== COMPONENT FACTORIES =====

export const createMeshComponent = (geometry: MeshGeometry, options?: Partial<Pick<MeshComponent, 'visible' | 'castShadows' | 'receiveShadows'>>): MeshComponent =>
  Data.struct({
    geometry,
    visible: options?.visible ?? true,
    castShadows: options?.castShadows ?? true,
    receiveShadows: options?.receiveShadows ?? true,
    isInstanced: false,
  })

export const createMaterialComponent = (
  albedo?: { r: number; g: number; b: number; a?: number },
  options?: Partial<Pick<MaterialComponent, 'metallic' | 'roughness' | 'transparent'>>,
): MaterialComponent =>
  Data.struct({
    albedo: {
      r: albedo?.r ?? 1,
      g: albedo?.g ?? 1,
      b: albedo?.b ?? 1,
      a: albedo?.a ?? 1,
    },
    metallic: options?.metallic ?? 0,
    roughness: options?.roughness ?? 0.5,
    emissive: { r: 0, g: 0, b: 0 },
    transparent: options?.transparent ?? false,
    doubleSided: false,
  })

export const createDirectionalLight = (color: { r: number; g: number; b: number } = { r: 1, g: 1, b: 1 }, intensity: number = 1): LightComponent =>
  Data.struct({
    type: 'directional' as const,
    color,
    intensity,
    castShadows: true,
    cullingMask: 0xffffffff,
    enabled: true,
  })

export const createPointLight = (color: { r: number; g: number; b: number } = { r: 1, g: 1, b: 1 }, intensity: number = 1, range: number = 10): LightComponent =>
  Data.struct({
    type: 'point' as const,
    color,
    intensity,
    range,
    castShadows: true,
    cullingMask: 0xffffffff,
    enabled: true,
  })

export const createPerspectiveCamera = (fov: number = Math.PI / 4, aspect: number = 1, near: number = 0.1, far: number = 1000): CameraComponent =>
  Data.struct({
    projectionType: 'perspective' as const,
    fov,
    aspect,
    near,
    far,
    up: { x: 0, y: 1, z: 0 },
    clearColor: { r: 0.2, g: 0.2, b: 0.3, a: 1 },
    clearFlags: { color: true, depth: true, stencil: false },
    frustumCulling: true,
    cullingMask: 0xffffffff,
    renderOrder: 0,
  })

export const createRenderableComponent = (layer: number = 0, options?: Partial<Pick<RenderableComponent, 'visible' | 'enabled'>>): RenderableComponent =>
  Data.struct({
    layer,
    sortingOrder: 0,
    visible: options?.visible ?? true,
    enabled: options?.enabled ?? true,
  })

// ===== RENDERING COMPONENT FACTORIES =====

export const RenderingComponentFactories = {
  createMeshComponent,
  createMaterialComponent,
  createDirectionalLight,
  createPointLight,
  createPerspectiveCamera,
  createRenderableComponent,
} as const
