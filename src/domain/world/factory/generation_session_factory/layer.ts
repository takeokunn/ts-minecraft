import { Layer } from 'effect'
import { GenerationSessionFactoryLive } from './index'

/**
 * GenerationSessionFactory完全統合Layer
 * 全ての依存関係を含む完全なLayer
 */
export const GenerationSessionFactoryCompleteLayer = Layer.mergeAll(
  GenerationSessionFactoryLive
  // 他の必要な依存関係をここに追加
)
