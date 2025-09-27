import { Layer } from 'effect'
import { AppServiceLive } from '../services/AppService'
import { GameApplicationLive } from '@application/GameApplicationLive'

// 依存サービスのLive実装
import { GameLoopServiceLive } from '@domain/game-loop/services/GameLoopServiceLive'
import { SceneManagerLive } from '@domain/scene/SceneManagerLive'
import { ThreeRendererLive } from '@infrastructure/rendering/ThreeRendererLive'
import { InputServiceLive } from '@domain/input/InputServiceLive'

/**
 * MainLayer - アプリケーション全体の統合レイヤー
 *
 * Issue #176: Application Layer Integration
 *
 * 全システムの依存関係を解決し、統合されたアプリケーションを提供
 * - GameLoop, Scene, Renderer, Input, ECS システムの統合
 * - 本番環境での実行用Layer構成
 * - テスト環境では個別のMockLayerを使用可能
 */

/**
 * 本番環境用のメインレイヤー
 *
 * 依存関係の順序:
 * 1. 基盤サービス（GameLoop, Scene, Renderer, Input）
 * 2. アプリケーション統合サービス（GameApplication）
 * 3. 既存のAppService
 */
const BaseServicesLayer = Layer.mergeAll(GameLoopServiceLive, SceneManagerLive, ThreeRendererLive, InputServiceLive)

const ApplicationLayer = GameApplicationLive.pipe(Layer.provide(BaseServicesLayer))

export const MainLayer = Layer.mergeAll(BaseServicesLayer, ApplicationLayer, AppServiceLive)

/**
 * テスト環境用のレイヤー
 *
 * Mock実装を使用してテストを高速化
 * 実際のWebGL/DOMに依存しない環境での実行が可能
 */
export const TestLayer = Layer.mergeAll(
  // TODO: Mock実装を作成
  // MockGameLoopServiceLive,
  // MockSceneManagerLive,
  // MockThreeRendererLive,
  // MockInputServiceLive,
  // MockGameApplicationLive,
  AppServiceLive
)
