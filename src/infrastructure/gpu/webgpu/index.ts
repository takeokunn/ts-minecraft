/**
 * WebGPU Infrastructure - GPU-accelerated rendering services
 * 
 * This module provides WebGPU-based rendering infrastructure services
 * for high-performance graphics rendering.
 */

// Renderer Layer (formerly RenderService)
export { RenderService } from './renderer.layer'
export type {
  RenderServiceInterface,
  SceneId,
  RenderableId,
  CameraId,
  LightId,
  MaterialId,
  TextureId,
  EffectId,
  SceneConfig,
  RenderableConfig,
  RenderableUpdates,
  CameraConfig,
  CameraUpdates,
  LightConfig,
  LightUpdates,
  MaterialConfig,
  MaterialUpdates,
  PostProcessEffect,
  RenderResult,
  RenderStats,
  RenderDebugMode,
  ScreenshotResult,
  ResourceUsage,
  OptimizationResult,
} from './renderer.layer'