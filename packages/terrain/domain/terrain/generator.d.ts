import { Effect } from 'effect';
import { ChunkService } from '../../application/chunk-service';
import type { Chunk } from '../chunk';
import { ChunkCoord } from '@ts-minecraft/kernel';
import type { BiomeGeneratorPort } from '../biome-generator-port';
import { NoiseServicePort } from '../noise-service-port';
export declare const generateTerrain: (chunkService: ChunkService, biomeService: BiomeGeneratorPort, noiseService: NoiseServicePort, coord: ChunkCoord) => Effect.Effect<Chunk, never>;
//# sourceMappingURL=generator.d.ts.map