/**
 * Infrastructure Adapters - Central exports for all adapter implementations
 * 
 * This module provides a unified interface to all adapter implementations,
 * making it easy to import and configure adapters throughout the application.
 * Adapters implement the Adapter pattern to isolate technical implementation
 * details from the domain layer.
 */

// Three.js Rendering Adapter
export {
  ThreeJsAdapter,
  ThreeJsContext,
  ThreeJsAdapterLive,
  ThreeJsContextLive,
  type IThreeJsAdapter,
  type IThreeJsContext,
  type RenderCommand
} from './three-js.adapter'

// Browser Input Adapter  
export {
  BrowserInputAdapter,
  BrowserInputAdapterLive,
  type IBrowserInputAdapter,
  type DomEvent
} from './browser-input.adapter'

// Clock Adapter
export {
  BrowserClockAdapter,
  BrowserClockAdapterLive,
  ClockUtils,
  type IBrowserClockAdapter
} from './clock.adapter'

// WebGPU Adapter
export {
  WebGPUAdapter,
  WebGPUAdapterLive,
  type IWebGPUAdapter,
  type WebGPUCapabilities,
  type WebGPURenderPipeline,
  type WebGPUComputePipeline,
  type WebGPUBufferManager,
  type WebGPUTextureManager
} from './webgpu.adapter'

// WebSocket Adapter
export {
  WebSocketAdapter,
  WebSocketAdapterLive,
  type IWebSocketAdapter,
  type WebSocketMessage,
  type ConnectionState,
  type WebSocketConfig
} from './websocket.adapter'

/**
 * Adapter Layer combinations for easy setup
 */
import * as Layer from 'effect/Layer'
import { ThreeJsAdapterLive, ThreeJsContextLive } from './three-js.adapter'
import { BrowserInputAdapterLive } from './browser-input.adapter'
import { BrowserClockAdapterLive } from './clock.adapter'
import { WebGPUAdapterLive } from './webgpu.adapter'
import { WebSocketAdapterLive } from './websocket.adapter'

/**
 * Complete rendering layer with Three.js
 */
export const ThreeJsRenderingLayer = Layer.mergeAll(
  ThreeJsContextLive,
  ThreeJsAdapterLive
)

/**
 * Complete input layer with browser support
 */
export const BrowserInputLayer = BrowserInputAdapterLive

/**
 * Complete timing layer with browser clock
 */
export const BrowserClockLayer = BrowserClockAdapterLive

/**
 * Complete WebGPU layer for advanced rendering
 */
export const WebGPULayer = WebGPUAdapterLive

/**
 * Complete networking layer with WebSocket
 */
export const WebSocketLayer = WebSocketAdapterLive

/**
 * All adapters combined for basic browser setup
 */
export const BasicBrowserAdapters = Layer.mergeAll(
  ThreeJsRenderingLayer,
  BrowserInputLayer,
  BrowserClockLayer
)

/**
 * Advanced adapters with WebGPU and networking
 */
export const AdvancedBrowserAdapters = Layer.mergeAll(
  ThreeJsRenderingLayer,
  WebGPULayer,
  BrowserInputLayer,
  BrowserClockLayer,
  WebSocketLayer
)

/**
 * Development adapters with full debugging support
 */
export const DevelopmentAdapters = Layer.mergeAll(
  ThreeJsRenderingLayer,
  WebGPULayer,
  BrowserInputLayer,
  BrowserClockLayer,
  WebSocketLayer
)

/**
 * Production optimized adapters
 */
export const ProductionAdapters = Layer.mergeAll(
  ThreeJsRenderingLayer,
  BrowserInputLayer,
  BrowserClockLayer
)

/**
 * Adapter utilities
 */
export const AdapterUtils = {
  /**
   * Check if WebGPU is available
   */
  isWebGPUAvailable: (): boolean => {
    return typeof navigator !== 'undefined' && !!navigator.gpu
  },

  /**
   * Check if Workers are available
   */
  areWorkersAvailable: (): boolean => {
    return typeof Worker !== 'undefined'
  },

  /**
   * Check if WebSockets are available
   */
  areWebSocketsAvailable: (): boolean => {
    return typeof WebSocket !== 'undefined'
  },

  /**
   * Get recommended adapter layer based on capabilities
   */
  getRecommendedAdapterLayer: () => {
    const hasWebGPU = AdapterUtils.isWebGPUAvailable()
    const hasWorkers = AdapterUtils.areWorkersAvailable()
    const hasWebSockets = AdapterUtils.areWebSocketsAvailable()

    if (hasWebGPU && hasWorkers && hasWebSockets) {
      return AdvancedBrowserAdapters
    } else if (hasWebGPU) {
      return Layer.mergeAll(
        ThreeJsRenderingLayer,
        WebGPULayer,
        BrowserInputLayer,
        BrowserClockLayer
      )
    } else {
      return BasicBrowserAdapters
    }
  }
}