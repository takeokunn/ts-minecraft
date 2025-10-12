import { WorldAggregateLive, WorldEventPublishersLive } from '@domain/world/aggregate'
import { WorldDomainServiceLayer } from '@domain/world/domain_service'
import { WorldDomainFactoryLayer } from '@domain/world/factory'
import { Layer } from 'effect'

export interface WorldDomainLayerOptions {
  /**
   * Repository 実装を提供する Layer（必須）
   */
  readonly repository: Layer.Layer<any>
  /**
   * WorldGeneration 依存を提供する Layer（任意）
   */
  readonly worldGeneration?: Layer.Layer<any>
  /**
   * 集約層を含めるか（デフォルト: true）
   */
  readonly includeAggregates?: boolean
  /**
   * 独自の集約 Layer を指定する場合
   */
  readonly aggregateLayer?: Layer.Layer<any>
}

const defaultAggregateLayer = Layer.mergeAll(WorldAggregateLive, WorldEventPublishersLive)

/**
 * World ドメイン Layer を組み立てるためのヘルパー。
 * リポジトリや world_generation などのインフラ依存は呼び出し側で注入する。
 */
export const createWorldDomainLayer = (options: WorldDomainLayerOptions): Layer.Layer<any> => {
  const base = Layer.mergeAll(options.repository, WorldDomainServiceLayer, WorldDomainFactoryLayer)
  const withWorldGeneration = options.worldGeneration ? Layer.provide(base, options.worldGeneration) : base

  if (options.includeAggregates === false) {
    return withWorldGeneration
  }

  const aggregates = options.aggregateLayer ?? defaultAggregateLayer
  return Layer.mergeAll(withWorldGeneration, aggregates)
}
