/**
 * Application Layer Dependency Injection Container
 *
 * このコンテナはアプリケーション層の依存性注入を管理します。
 * ドメインサービスとポート経由でのインフラサービス注入を提供します。
 *
 * 設計原則:
 * - アプリケーション層がインフラ層を直接参照しない
 * - すべての外部依存はポート経由で注入
 * - ドメインサービスへの依存は直接注入可能
 * - 循環依存の回避
 */

import { Layer } from 'effect'

// Domain Services
import { WorldDomainService } from '@domain/services/world-domain.service'
import { EntityDomainService } from '@domain/services/entity-domain.service'
import { PhysicsDomainService } from '@domain/services/physics-domain.service'

// Domain Ports (for infrastructure dependencies)
import { ClockPort } from '@domain/ports/clock.port'
import { SystemCommunicationPort } from '@domain/ports/system-communication.port'
import { PerformanceMonitorPort } from '@domain/ports/performance-monitor.port'

// Application Layer Components
import { CommandHandlersLive } from '@application/handlers/command-handlers'
import { QueryHandlersLive } from '@application/handlers/query-handlers'
import { PlayerMoveUseCaseLive } from '@application/use-cases/player-move.use-case'
import { BlockPlaceUseCaseLive } from '@application/use-cases/block-place.use-case'
import { ChunkLoadUseCaseLive } from '@application/use-cases/chunk-load.use-case'
import { WorldGenerateUseCaseLive } from '@application/use-cases/world-generate.use-case'
import { WorldUpdateWorkflowLive } from '@application/workflows/world-update'
import { UIUpdateWorkflowLive } from '@application/workflows/ui-update'
import { SystemSchedulerServiceLive } from '@application/workflows/system-scheduler.service'

/**
 * Application Layer Dependencies
 *
 * アプリケーション層が必要とするドメインサービスおよびポートの依存関係
 * ドメインサービスへの直接依存と、インフラ依存のためのポート
 */
export type ApplicationDependencies =
  | typeof WorldDomainService
  | typeof EntityDomainService
  | typeof PhysicsDomainService
  | typeof ClockPort
  | typeof SystemCommunicationPort
  | typeof PerformanceMonitorPort

/**
 * Complete Application Layer
 *
 * すべてのアプリケーション層コンポーネントを統合したレイヤー
 * ドメインサービスに依存し、インフラ層への直接依存は避ける
 */
export const ApplicationLayerComplete = Layer.mergeAll(
  // CQRS Handlers
  CommandHandlersLive,
  QueryHandlersLive,

  // Use Cases
  PlayerMoveUseCaseLive,
  BlockPlaceUseCaseLive,
  ChunkLoadUseCaseLive,
  WorldGenerateUseCaseLive,

  // Workflows (now with performance monitoring)
  WorldUpdateWorkflowLive,
  UIUpdateWorkflowLive,

  // System Services
  SystemSchedulerServiceLive(),
)

/**
 * Create Application Container
 *
 * ドメインサービスの依存関係と共にアプリケーション層を作成
 */
export const createApplicationContainer = () => ApplicationLayerComplete

/**
 * Application Container Health Check
 *
 * アプリケーション層の健全性チェック用の型定義
 */
export interface ApplicationHealthStatus {
  readonly isHealthy: boolean
  readonly services: {
    readonly commandHandlers: boolean
    readonly queryHandlers: boolean
    readonly useCases: boolean
    readonly workflows: boolean
    readonly systemScheduler: boolean
  }
  readonly errors: string[]
  readonly timestamp: number
}

/**
 * Application Layer Validation
 *
 * アプリケーション層の構成が正しいかを検証する関数
 */
export const validateApplicationLayer = (): string[] => {
  const errors: string[] = []

  // 基本的な構成チェック（実際の実装では各コンポーネントの存在確認）
  // この実装は開発時のデバッグ用のプレースホルダー

  return errors
}

// Types are already exported inline above
