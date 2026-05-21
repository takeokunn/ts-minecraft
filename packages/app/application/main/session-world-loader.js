import { Array as Arr, Clock, Duration, Effect, Option, Random } from 'effect';
import { StartupError } from '@ts-minecraft/game';
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex, blockTypeToIndex } from '@ts-minecraft/kernel';
import { MAX_SEED_VALUE } from '@ts-minecraft/app/main.config';
const SPAWN_HEADROOM_BLOCKS = 3;
const FALLBACK_SURFACE_Y = 64;
const SPAWN_SEARCH_CHUNK_RADIUS = 2;
const NON_SPAWN_SURFACE_BLOCKS = new Set([
    blockTypeToIndex('AIR'),
    blockTypeToIndex('WATER'),
    blockTypeToIndex('LAVA'),
    blockTypeToIndex('WOOD'),
    blockTypeToIndex('LEAVES'),
]);
const localBlockIndex = (lx, y, lz) => Option.getOrNull(blockIndex(lx, y, lz));
const isAirAt = (blocks, lx, y, lz) => {
    const idx = localBlockIndex(lx, y, lz);
    return idx !== null && blocks[idx] === blockTypeToIndex('AIR');
};
const hasSpawnHeadroom = (blocks, lx, surfaceY, lz) => Arr.every(Arr.makeBy(SPAWN_HEADROOM_BLOCKS, (i) => i + 1), (offset) => surfaceY + offset < CHUNK_HEIGHT && isAirAt(blocks, lx, surfaceY + offset, lz));
const findSpawnSurfaceY = (blocks, lx, lz) => Arr.findFirst(Arr.makeBy(CHUNK_HEIGHT - SPAWN_HEADROOM_BLOCKS, (i) => CHUNK_HEIGHT - SPAWN_HEADROOM_BLOCKS - 1 - i), (y) => {
    const idx = localBlockIndex(lx, y, lz);
    return idx !== null
        && !NON_SPAWN_SURFACE_BLOCKS.has(blocks[idx] ?? blockTypeToIndex('AIR'))
        && hasSpawnHeadroom(blocks, lx, y, lz);
});
const chunkCoordFromWorld = (coord) => Math.floor(coord / CHUNK_SIZE);
const spawnSearchChunkCoords = (baseSpawnPosition) => {
    const baseChunkX = chunkCoordFromWorld(baseSpawnPosition.x);
    const baseChunkZ = chunkCoordFromWorld(baseSpawnPosition.z);
    const diameter = SPAWN_SEARCH_CHUNK_RADIUS * 2 + 1;
    return Arr.flatMap(Arr.makeBy(diameter, (xOffset) => baseChunkX - SPAWN_SEARCH_CHUNK_RADIUS + xOffset), (x) => Arr.map(Arr.makeBy(diameter, (zOffset) => baseChunkZ - SPAWN_SEARCH_CHUNK_RADIUS + zOffset), (z) => ({ x, z })));
};
const findNearestSpawnSurface = (blocks, baseSpawnPosition, chunkCoord) => Arr.reduce(Arr.flatMap(Arr.makeBy(CHUNK_SIZE, (lx) => lx), (lx) => Arr.filterMap(Arr.makeBy(CHUNK_SIZE, (lz) => lz), (lz) => Option.map(findSpawnSurfaceY(blocks, lx, lz), (surfaceY) => {
    const worldX = chunkCoord.x * CHUNK_SIZE + lx;
    const worldZ = chunkCoord.z * CHUNK_SIZE + lz;
    return {
        worldX,
        worldZ,
        surfaceY,
        distanceSq: (worldX - baseSpawnPosition.x) ** 2 + (worldZ - baseSpawnPosition.z) ** 2,
    };
}))), Option.none(), (best, candidate) => Option.match(best, {
    onNone: () => Option.some(candidate),
    onSome: (current) => candidate.distanceSq < current.distanceSq
        || (candidate.distanceSq === current.distanceSq && candidate.surfaceY > current.surfaceY)
        ? Option.some(candidate)
        : best,
}));
export const loadOrCreateWorld = (worldId, initialGameMode, storageService, noiseService, gameModeService) => Effect.raceFirst(storageService.loadWorldMetadata(worldId), Effect.sleep(Duration.seconds(10)).pipe(Effect.flatMap(() => Effect.fail(new Error('Timed out while loading world metadata'))))).pipe(Effect.mapError((cause) => new StartupError({ reason: 'Failed to load world metadata', cause })), Effect.flatMap((existingMetadata) => Option.match(existingMetadata, {
    onSome: (metadata) => noiseService.setSeed(metadata.seed).pipe(Effect.andThen(gameModeService.set(metadata.gameMode)), Effect.andThen(Effect.log(`Loaded world '${worldId}' with seed ${metadata.seed} (gameMode=${metadata.gameMode}, saveVersion=${metadata.saveVersion})`)), Effect.as({
        seed: metadata.seed,
        createdAt: metadata.createdAt,
        baseSpawnPosition: Option.getOrElse(Option.fromNullable(metadata.playerSpawn), () => ({ x: 0, y: 100, z: 0 })),
        savedPlayerState: Option.fromNullable(metadata.playerState),
        savedFurnaceStates: Option.fromNullable(metadata.furnaceStates),
        gameMode: metadata.gameMode,
    })),
    onNone: () => Effect.all([Random.nextIntBetween(0, MAX_SEED_VALUE), Clock.currentTimeMillis], { concurrency: 'unbounded' }).pipe(Effect.flatMap(([seed, nowMs]) => {
        const pos = { x: 0, y: 100, z: 0 };
        const now = new Date(nowMs);
        return noiseService.setSeed(seed).pipe(Effect.andThen(Effect.raceFirst(storageService.saveWorldMetadata(worldId, {
            seed,
            createdAt: now,
            lastPlayed: now,
            playerSpawn: pos,
            gameMode: initialGameMode,
            saveVersion: 1,
        }), Effect.sleep(Duration.seconds(10)).pipe(Effect.flatMap(() => Effect.fail(new Error('Timed out while saving world metadata')))))), Effect.andThen(Effect.log(`Created new world '${worldId}' with seed ${seed} (gameMode=${initialGameMode})`)), Effect.as({
            seed,
            createdAt: now,
            baseSpawnPosition: pos,
            savedPlayerState: Option.none(),
            savedFurnaceStates: Option.none(),
            gameMode: initialGameMode,
        }), Effect.mapError((cause) => new StartupError({ reason: 'Failed to save fresh world metadata', cause })));
    })),
})));
export const buildRespawnPosition = (baseSpawnPosition, chunkManagerService) => Effect.gen(function* () {
    const candidateOptions = yield* Effect.forEach(spawnSearchChunkCoords(baseSpawnPosition), (coord) => chunkManagerService.getChunk(coord).pipe(Effect.map((chunk) => findNearestSpawnSurface(chunk.blocks, baseSpawnPosition, chunk.coord))), { concurrency: 4 });
    const bestCandidate = Arr.reduce(candidateOptions, Option.none(), (best, candidateOption) => Option.match(candidateOption, {
        onNone: () => best,
        onSome: (candidate) => Option.match(best, {
            onNone: () => Option.some(candidate),
            onSome: (current) => candidate.distanceSq < current.distanceSq
                || (candidate.distanceSq === current.distanceSq && candidate.surfaceY > current.surfaceY)
                ? Option.some(candidate)
                : best,
        }),
    }));
    return Option.match(bestCandidate, {
        onNone: () => ({ ...baseSpawnPosition, y: FALLBACK_SURFACE_Y + 1 + SPAWN_HEADROOM_BLOCKS }),
        onSome: ({ worldX, worldZ, surfaceY }) => ({
            x: worldX,
            y: surfaceY + 1 + SPAWN_HEADROOM_BLOCKS,
            z: worldZ,
        }),
    });
});
//# sourceMappingURL=../../../../dist/packages/app/application/main/session-world-loader.js.map