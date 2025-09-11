import { defineError } from './generator'
import { RenderingError as BaseRenderingError } from './base-errors'

/**
 * General rendering operation failed
 * Recovery: Skip frame or use fallback rendering
 */
export const RenderingError = defineError<{
  readonly operation: string
  readonly details: string
  readonly renderTarget?: 'screen' | 'texture' | 'shadow-map'
  readonly frameNumber?: number
}>('RenderingError', BaseRenderingError, 'fallback', 'medium')

/**
 * Texture resource not found
 * Recovery: Use default/fallback texture
 */
export const TextureNotFoundError = defineError<{
  readonly textureName: string
  readonly requestedPath: string
  readonly availableTextures?: string[]
  readonly textureType?: 'diffuse' | 'normal' | 'specular' | 'height'
}>('TextureNotFoundError', BaseRenderingError, 'fallback', 'low')

/**
 * Material definition not found
 * Recovery: Use default material
 */
export const MaterialNotFoundError = defineError<{
  readonly materialName: string
  readonly requestedProperties?: string[]
  readonly availableMaterials?: string[]
}>('MaterialNotFoundError', BaseRenderingError, 'fallback', 'low')

/**
 * Shader compilation failed
 * Recovery: Use fallback shader or disable effect
 */
export const ShaderCompilationError = defineError<{
  readonly shaderName: string
  readonly shaderType: 'vertex' | 'fragment' | 'geometry' | 'compute'
  readonly compilationErrors: string[]
  readonly source?: string
}>('ShaderCompilationError', BaseRenderingError, 'fallback', 'high')

/**
 * GPU buffer allocation failed
 * Recovery: Reduce buffer size or use alternative storage
 */
export const BufferAllocationError = defineError<{
  readonly bufferType: 'vertex' | 'index' | 'uniform' | 'texture' | 'storage'
  readonly requestedSize: number
  readonly availableMemory?: number
  readonly reason: string
}>('BufferAllocationError', BaseRenderingError, 'fallback', 'high')

/**
 * Render target creation failed
 * Recovery: Use main framebuffer or reduce quality
 */
export const RenderTargetError = defineError<{
  readonly targetType: 'framebuffer' | 'texture' | 'depth-buffer'
  readonly dimensions: { width: number; height: number }
  readonly format: string
  readonly reason: string
}>('RenderTargetError', BaseRenderingError, 'fallback', 'medium')

/**
 * Mesh data is invalid or corrupted
 * Recovery: Use fallback geometry or skip rendering
 */
export const MeshDataError = defineError<{
  readonly meshName: string
  readonly dataType: 'vertices' | 'indices' | 'normals' | 'uvs'
  readonly expectedCount: number
  readonly actualCount: number
}>('MeshDataError', BaseRenderingError, 'fallback', 'medium')

/**
 * Graphics context lost
 * Recovery: Recreate context and restore state
 */
export const GraphicsContextError = defineError<{
  readonly contextType: 'webgl' | 'webgl2' | 'webgpu'
  readonly reason: string
  readonly canRestore: boolean
  readonly lostResources?: string[]
}>('GraphicsContextError', BaseRenderingError, 'retry', 'critical')