import { Context } from 'effect'
import type { Effect } from 'effect/Effect'

export interface GameApplicationHealthReport {
  readonly gameLoop: { readonly status: 'healthy' | 'unhealthy'; readonly fps?: number }
  readonly renderer: { readonly status: 'healthy' | 'unhealthy'; readonly memory?: number }
  readonly scene: { readonly status: 'healthy' | 'unhealthy'; readonly sceneCount?: number }
  readonly input: { readonly status: 'healthy' | 'unhealthy' }
  readonly ecs: { readonly status: 'healthy' | 'unhealthy'; readonly entityCount?: number }
}

export interface HealthCheckGameApplication {
  readonly execute: () => Effect<GameApplicationHealthReport, never, never>
}

export const HealthCheckGameApplication = Context.GenericTag<HealthCheckGameApplication>(
  '@mc/bc-world/application/use-cases/HealthCheckGameApplication'
)
