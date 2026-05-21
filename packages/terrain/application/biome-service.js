import { Array as Arr, Effect } from 'effect';
import { NoiseServicePort } from '../domain/noise-service-port';
import { CHUNK_SIZE } from '@ts-minecraft/kernel';
import { BIOME_PROPERTIES, BIOME_SCALE, HUMIDITY_WORLD_OFFSET, RIVER_NOISE_SCALE, RIVER_WORLD_OFFSET, } from './biome-service.config';
import { classifyBiomeFromClimate, buildChunkNoiseInputs, batchTerrainIndexFor, peaksAndValleysFromWeirdness, refineBeachBiome, } from '../domain/biome-classifier';
// ─── Service ─────────────────────────────────────────────────────────────────
export class BiomeService extends Effect.Service()('@minecraft/application/BiomeService', {
    effect: Effect.map(NoiseServicePort, (noiseService) => {
        const getTemperature = (x, z) => noiseService.octaveNoise2D(x * BIOME_SCALE, z * BIOME_SCALE, 4, 0.5, 2.0);
        const getHumidity = (x, z) => noiseService.octaveNoise2D((x + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE, (z + HUMIDITY_WORLD_OFFSET) * BIOME_SCALE, 4, 0.5, 2.0);
        const getBiome = (x, z) => Effect.all([
            getTemperature(x, z),
            getHumidity(x, z),
            noiseService.continentalness(x, z),
            noiseService.erosion(x, z),
            noiseService.weirdness(x, z),
            noiseService.noise2D(x * RIVER_NOISE_SCALE + RIVER_WORLD_OFFSET, z * RIVER_NOISE_SCALE + RIVER_WORLD_OFFSET),
        ], { concurrency: 'unbounded' }).pipe(Effect.map(([temp, hum, continentalness, erosion, weirdness, riverNoise]) => classifyBiomeFromClimate({
            temperature: temp,
            humidity: hum,
            continentalness,
            erosion,
            pv: peaksAndValleysFromWeirdness(weirdness),
            riverNoise,
        })));
        const getBiomeProperties = (biome) => Effect.succeed(BIOME_PROPERTIES[biome]);
        const coordKey = (x, z) => `${x},${z}`;
        const addOutsideNeighbor = (coords, indexByKey, x, z) => {
            const key = coordKey(x, z);
            if (!indexByKey.has(key)) {
                indexByKey.set(key, coords.length);
                coords.push({ key, x, z });
            }
        };
        const getBiomesAndPropertiesForChunk = (chunkX, chunkZ) => {
            const coords = buildChunkNoiseInputs(chunkX, chunkZ);
            return Effect.all([
                noiseService.octaveNoise2DBatchXY(Arr.map(coords, (c) => c.tempX), Arr.map(coords, (c) => c.tempZ), 4, 0.5, 2.0),
                noiseService.octaveNoise2DBatchXY(Arr.map(coords, (c) => c.humX), Arr.map(coords, (c) => c.humZ), 4, 0.5, 2.0),
                noiseService.sampleTerrainChannels(chunkX * CHUNK_SIZE, chunkZ * CHUNK_SIZE),
                noiseService.noise2DBatchXY(Arr.map(coords, (c) => c.tempX * (RIVER_NOISE_SCALE / BIOME_SCALE) + RIVER_WORLD_OFFSET), Arr.map(coords, (c) => c.tempZ * (RIVER_NOISE_SCALE / BIOME_SCALE) + RIVER_WORLD_OFFSET)),
            ], { concurrency: 'unbounded' }).pipe(Effect.flatMap(([tempVals, humVals, terrainChannels, riverNoiseVals]) => {
                const baseBiomes = Arr.makeBy(coords.length, (i) => {
                    const terrainIdx = batchTerrainIndexFor(i);
                    return classifyBiomeFromClimate({
                        temperature: tempVals[i],
                        humidity: humVals[i],
                        continentalness: terrainChannels.continentalness[terrainIdx],
                        erosion: terrainChannels.erosion[terrainIdx],
                        pv: terrainChannels.pv[terrainIdx],
                        riverNoise: riverNoiseVals[i],
                    });
                });
                const outsideNeighborCoords = [];
                const outsideNeighborIndexByKey = new Map();
                const baseWorldX = chunkX * CHUNK_SIZE;
                const baseWorldZ = chunkZ * CHUNK_SIZE;
                for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                    const worldX = baseWorldX + lx;
                    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                        const worldZ = baseWorldZ + lz;
                        if (lx === 0)
                            addOutsideNeighbor(outsideNeighborCoords, outsideNeighborIndexByKey, worldX - 1, worldZ);
                        if (lx === CHUNK_SIZE - 1)
                            addOutsideNeighbor(outsideNeighborCoords, outsideNeighborIndexByKey, worldX + 1, worldZ);
                        if (lz === 0)
                            addOutsideNeighbor(outsideNeighborCoords, outsideNeighborIndexByKey, worldX, worldZ - 1);
                        if (lz === CHUNK_SIZE - 1)
                            addOutsideNeighbor(outsideNeighborCoords, outsideNeighborIndexByKey, worldX, worldZ + 1);
                    }
                }
                return Effect.forEach(outsideNeighborCoords, ({ x, z }) => getBiome(x, z), { concurrency: 'unbounded' }).pipe(Effect.map((outsideNeighborBiomes) => Arr.makeBy(coords.length, (i) => {
                    const lx = Math.floor(i / CHUNK_SIZE);
                    const lz = i % CHUNK_SIZE;
                    const worldX = baseWorldX + lx;
                    const worldZ = baseWorldZ + lz;
                    const biome = baseBiomes[i];
                    const terrainIdx = batchTerrainIndexFor(i);
                    const getNeighborBiome = (dx, dz) => {
                        const nx = lx + dx;
                        const nz = lz + dz;
                        if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
                            return baseBiomes[nx * CHUNK_SIZE + nz];
                        }
                        const outsideIndex = outsideNeighborIndexByKey.get(coordKey(worldX + dx, worldZ + dz));
                        return outsideIndex === undefined ? biome : outsideNeighborBiomes[outsideIndex];
                    };
                    const refinedBiome = refineBeachBiome(biome, [
                        getNeighborBiome(-1, 0),
                        getNeighborBiome(1, 0),
                        getNeighborBiome(0, -1),
                        getNeighborBiome(0, 1),
                    ], terrainChannels.continentalness[terrainIdx]);
                    return { biome: refinedBiome, props: BIOME_PROPERTIES[refinedBiome] };
                })));
            }));
        };
        return { getBiome, getBiomeProperties, getTemperature, getHumidity, getBiomesAndPropertiesForChunk };
    }),
}) {
}
export const BiomeServiceLive = BiomeService.Default;
//# sourceMappingURL=../../../dist/packages/terrain/application/biome-service.js.map