/**
 * World Generation Application Layer
 *
 * WorldGenerationAPIServiceをインフラ/ドメイン依存と結合した統合Layer。
 * ノイズ/バイオームサービスを含むアダプタとイベントストリームを提供するDomain層を接続する。
 */

import { BiomeDomainLive } from '@/domain/biome/layers'
import { WorldGenerationDomainLive } from '@/domain/world_generation/layers'
import { WorldGenerationAdapterLayer } from '@/infrastructure/world_generation/world_generation_adapter'
import { Layer } from 'effect'
import { WorldGenerationAPIServiceLive } from './api-service'

export const WorldGenerationApplicationServicesLayer = Layer.mergeAll(
  WorldGenerationAdapterLayer,
  WorldGenerationAPIServiceLive
)

export const WorldGenerationApplicationLive = WorldGenerationApplicationServicesLayer.pipe(
  Layer.provide(WorldGenerationDomainLive.pipe(Layer.provide(BiomeDomainLive)))
)
