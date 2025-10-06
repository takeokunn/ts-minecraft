/**
 * @fileoverview ResourceLimits値オブジェクトのバレルエクスポート
 * リソース制限と圧力計算
 */

export {
  blendMemoryPressure,
  computeTargetActiveChunks,
  shouldEvictChunks,
  shouldThrottleActivations,
} from './resource_limits'
