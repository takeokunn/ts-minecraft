/**
 * Rendering Components
 * Components related to visual representation and rendering
 */

export { 
  CameraComponent,
  CameraStateComponent,
  type CameraComponent as CameraComponentType,
  type CameraStateComponent as CameraStateComponentType,
} from './camera'

export { 
  RenderableComponent,
  InstancedMeshRenderableComponent,
  type RenderableComponent as RenderableComponentType,
  type InstancedMeshRenderableComponent as InstancedMeshRenderableComponentType,
} from './renderable'

// Aggregate rendering component schemas for registration
export const RenderingComponentSchemas = {
  camera: () => import('./camera').then(m => m.CameraComponent),
  cameraState: () => import('./camera').then(m => m.CameraStateComponent),
  renderable: () => import('./renderable').then(m => m.RenderableComponent),
  instancedMeshRenderable: () => import('./renderable').then(m => m.InstancedMeshRenderableComponent),
} as const