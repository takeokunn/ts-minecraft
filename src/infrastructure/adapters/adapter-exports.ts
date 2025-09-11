/**
 * Infrastructure Adapters - Detailed Adapter Exports
 *
 * This module contains all detailed export statements for adapter implementations.
 * Adapters implement the Adapter pattern to isolate technical implementation
 * details from the domain layer.
 */

// Three.js Rendering Adapter
export { ThreeJsAdapter, ThreeJsContext, ThreeJsAdapterLive, ThreeJsContextLive, type IThreeJsAdapter, type IThreeJsContext, type RenderCommand } from '@infrastructure/adapters/three-js.adapter'

// Browser Input Adapter
export { BrowserInputAdapter, BrowserInputAdapterLive, type IBrowserInputAdapter, type DomEvent } from '@infrastructure/adapters/browser-input.adapter'

// Clock Adapter
export { BrowserClockAdapter, BrowserClockAdapterLive, ClockUtils, type IBrowserClockAdapter } from '@infrastructure/adapters/clock.adapter'

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
} from '@infrastructure/adapters/webgpu.adapter'

// WebSocket Adapter
export { WebSocketAdapter, WebSocketAdapterLive, type IWebSocketAdapter, type WebSocketMessage, type ConnectionState, type WebSocketConfig } from '@infrastructure/adapters/websocket.adapter'

// Terrain Generator Adapter
export { TerrainGeneratorAdapter, TerrainGeneratorAdapterLive, createTerrainGeneratorAdapter, TerrainGeneratorAdapterUtils } from '@infrastructure/adapters/terrain-generator.adapter'

// Mesh Generator Adapter
export { MeshGeneratorAdapter, MeshGeneratorAdapterLive, createMeshGeneratorAdapter, MeshGeneratorAdapterUtils } from '@infrastructure/adapters/mesh-generator.adapter'

// System Communication Adapter
export { SystemCommunicationAdapter, SystemCommunicationLive } from '@infrastructure/adapters/system-communication.adapter'

// Performance Monitor Adapter
export { PerformanceMonitorAdapter, PerformanceMonitorLive } from '@infrastructure/adapters/performance-monitor.adapter'

// Spatial Grid Adapter
export { SpatialGridAdapter, SpatialGridAdapterLive, SpatialGridAdapterUtils } from '@infrastructure/adapters/spatial-grid.adapter'

// Material Manager Adapter
export { MaterialManagerAdapter, MaterialManagerAdapterLive, MaterialManagerAdapterUtils } from '@infrastructure/adapters/material-manager.adapter'

// Math Adapters
export {
  ThreeJsVector3AdapterLive,
  ThreeJsQuaternionAdapterLive,
  ThreeJsRayAdapterLive,
  ThreeJsMatrix4AdapterLive,
  ThreeJsMathAdapterLive,
  AllThreeJsMathAdaptersLive,
} from '@infrastructure/adapters/threejs-math.adapter'

export {
  NativeVector3AdapterLive,
  NativeQuaternionAdapterLive,
  NativeRayAdapterLive,
  NativeMatrix4AdapterLive,
  NativeMathAdapterLive,
  AllNativeMathAdaptersLive,
} from '@infrastructure/adapters/native-math.adapter'

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
} from '@infrastructure/adapters/ports-adapters-validation'