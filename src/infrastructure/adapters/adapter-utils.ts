/**
 * Adapter utilities and layer compositions
 */
import * as Layer from 'effect/Layer'
import { ThreeJsAdapterLive, ThreeJsContextLive } from '@infrastructure/adapters/three-js.adapter'
import { BrowserInputAdapterLive } from '@infrastructure/adapters/browser-input.adapter'
import { BrowserClockAdapterLive } from '@infrastructure/adapters/clock.adapter'
import { WebGPUAdapterLive } from '@infrastructure/adapters/webgpu.adapter'
import { WebSocketAdapterLive } from '@infrastructure/adapters/websocket.adapter'

/**
 * Adapter Layer combinations for easy setup
 */

/**
 * Complete rendering layer with Three.js
 */
export const ThreeJsRenderingLayer = Layer.mergeAll(ThreeJsContextLive, ThreeJsAdapterLive)

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
export const BasicBrowserAdapters = Layer.mergeAll(ThreeJsRenderingLayer, BrowserInputLayer, BrowserClockLayer)

/**
 * Advanced adapters with WebGPU and networking
 */
export const AdvancedBrowserAdapters = Layer.mergeAll(ThreeJsRenderingLayer, WebGPULayer, BrowserInputLayer, BrowserClockLayer, WebSocketLayer)

/**
 * Development adapters with full debugging support
 */
export const DevelopmentAdapters = Layer.mergeAll(ThreeJsRenderingLayer, WebGPULayer, BrowserInputLayer, BrowserClockLayer, WebSocketLayer)

/**
 * Production optimized adapters
 */
export const ProductionAdapters = Layer.mergeAll(ThreeJsRenderingLayer, BrowserInputLayer, BrowserClockLayer)

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
      return Layer.mergeAll(ThreeJsRenderingLayer, WebGPULayer, BrowserInputLayer, BrowserClockLayer)
    } else {
      return BasicBrowserAdapters
    }
  },
}
