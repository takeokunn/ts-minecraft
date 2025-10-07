import { Layer } from 'effect'
import { WorldGeneratorFactoryLive } from './index'

/**
 * WorldGeneratorFactory完全統合Layer
 * 全ての依存関係を含む完全なLayer
 */
export const WorldGeneratorFactoryCompleteLayer = Layer.mergeAll(
  WorldGeneratorFactoryLive
  // 他の必要な依存関係をここに追加
)
