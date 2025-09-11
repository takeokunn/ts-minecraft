/**
 * Infrastructure Adapters - Detailed Adapter Exports
 *
 * This module contains all detailed export statements for adapter implementations.
 * Adapters implement the Adapter pattern to isolate technical implementation
 * details from the domain layer.
 */

// Three.js Rendering Adapter
export { ThreeJsAdapter, ThreeJsContext, ThreeJsAdapterLive, ThreeJsContextLive, type IThreeJsAdapter, type IThreeJsContext, type RenderCommand } from './three-js.adapter'

// Browser Input Adapter
export { BrowserInputAdapter, BrowserInputAdapterLive, type IBrowserInputAdapter, type DomEvent } from './browser-input.adapter'

// Clock Adapter
export { BrowserClockAdapter, BrowserClockAdapterLive, ClockUtils, type IBrowserClockAdapter } from './clock.adapter'

// WebGPU Adapter
export {
  WebGPUAdapter,
  WebGPUAdapterLive,
  type IWebGPUAdapter,
  type WebGPUCapabilities,
  type WebGPURenderPipeline,
  type WebGPUComputePipeline,
  type WebGPUBufferManager,
  type WebGPUTextureManager,
} from './webgpu.adapter'

// WebSocket Adapter
export { WebSocketAdapter, WebSocketAdapterLive, type IWebSocketAdapter, type WebSocketMessage, type ConnectionState, type WebSocketConfig } from './websocket.adapter'

// Terrain Generator Adapter
export { TerrainGeneratorAdapter, TerrainGeneratorAdapterLive, createTerrainGeneratorAdapter, TerrainGeneratorAdapterUtils } from './terrain-generator.adapter'

// Mesh Generator Adapter
export { MeshGeneratorAdapter, MeshGeneratorAdapterLive, createMeshGeneratorAdapter, MeshGeneratorAdapterUtils } from './mesh-generator.adapter'

// System Communication Adapter
export { SystemCommunicationAdapter, SystemCommunicationLive } from './system-communication.adapter'

// Performance Monitor Adapter
export { PerformanceMonitorAdapter, PerformanceMonitorLive } from './performance-monitor.adapter'

// Spatial Grid Adapter
export { SpatialGridAdapter, SpatialGridAdapterLive, SpatialGridAdapterUtils } from './spatial-grid.adapter'

// Material Manager Adapter
export { MaterialManagerAdapter, MaterialManagerAdapterLive, MaterialManagerAdapterUtils } from './material-manager.adapter'

// Math Adapters
export {
  ThreeJsVector3AdapterLive,
  ThreeJsQuaternionAdapterLive,
  ThreeJsRayAdapterLive,
  ThreeJsMathAdapterLive,
  AllThreeJsMathAdaptersLive,
} from './threejs-math.adapter'

export {
  NativeVector3AdapterLive,
  NativeQuaternionAdapterLive,
  NativeRayAdapterLive,
  NativeMathAdapterLive,
  AllNativeMathAdaptersLive,
} from './native-math.adapter'

// Validation and utilities
export {
  testMathPorts,
  testRenderPortInterface,
  testWorldRepositoryPortInterface,
  validateDependencyInversion,
  validateAdapterCompliance,
  testMathAdapterSwitching,
  testAdapterErrorHandling,
  runPortsAdaptersValidation,
  implementationSummary,
} from './ports-adapters-validation'