import type { TimeService, WeatherService } from '@ts-minecraft/game'
import type { ChunkMeshService, WorldRendererService } from '@ts-minecraft/rendering'
import type { BiomeService, ChunkManagerService, NetherService } from '@ts-minecraft/world'

export type FrameWorldServices = {
  readonly chunkManagerService: ChunkManagerService
  readonly worldRendererService: WorldRendererService
  readonly chunkMeshService: ChunkMeshService
  readonly timeService: TimeService
  readonly weatherService: WeatherService
  readonly biomeService: BiomeService
  readonly netherService: NetherService
}
