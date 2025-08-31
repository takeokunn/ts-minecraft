import { Effect } from 'effect';
import * as noise from 'perlin-noise';
import {
  DestroyedBlock,
  Position,
  Renderable,
  TerrainBlock,
} from '../domain/components';
import { GameState } from '../runtime/game-state';
import { World } from '../runtime/world';
import { BlockType } from '../domain/block';

export const CHUNK_SIZE = 10;
const RENDER_DISTANCE = 4;
const WATER_LEVEL = 0;
const WORLD_DEPTH = 5; // How many blocks deep the terrain generates
const MIN_WORLD_Y = -250;

type Biome = 'plains' | 'desert';

// This structure mimics the one in 3dminecraft.html
const blockGenerationRules: ReadonlyArray<{
  name: BlockType;
  range: ReadonlyArray<number>;
  biomes: ReadonlyArray<Biome>;
}> = [
  { name: 'grass', range: [0], biomes: ['plains'] },
  { name: 'dirt', range: [1, 2], biomes: ['plains'] },
  { name: 'sand', range: [0, 1, 2], biomes: ['desert'] },
  { name: 'stone', range: [3, 4], biomes: ['plains', 'desert'] },
  // cobblestone was used for stone in the original
  { name: 'cobblestone', range: [3, 4], biomes: ['plains', 'desert'] },
];

function getBiome(n: number): Biome {
  if (n < 0.2) {
    return 'plains';
  } else {
    return 'desert';
  }
}

export const generateChunk = (
  chunkX: number,
  chunkZ: number,
): Effect.Effect<void, never, GameState | World> =>
  Effect.gen(function* (_) {
    const gameStateService = yield* _(GameState);
    const world = yield* _(World);
    const gameState = yield* _(gameStateService.get);
    const { seeds, amplitude, editedBlocks } = gameState;
    const { world: worldSeed, biome, trees } = seeds;
    const { destroyed, placed } = editedBlocks;

    const creations: Effect.Effect<void, never, World>[] = [];
    const destroyedSet: Set<string> = new Set(
      destroyed.map((b: DestroyedBlock) => `${b.x},${b.y},${b.z}`),
    );

    const startX: number = chunkX * CHUNK_SIZE;
    const startZ: number = chunkZ * CHUNK_SIZE;
    const inc = 0.05;

    for (let x = startX; x < startX + CHUNK_SIZE; x++) {
      for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
        const xoff: number = inc * x;
        const zoff: number = inc * z;

        noise.seed(worldSeed);
        const v: number =
          Math.round((noise.perlin2(xoff, zoff) * amplitude) / 1) * 1;

        noise.seed(biome);
        const currentBiome: Biome = getBiome(noise.perlin2(xoff / 1, zoff / 1)); // biomeSize = 1

        noise.seed(trees);
        const treeNoise: number = noise.perlin2(xoff / 1, zoff / 1); // treeDensity = 1

        // --- Water Generation ---
        let h = 1;
        while (v + h <= WATER_LEVEL) {
          const pos = { x, y: v + h, z };
          if (!destroyedSet.has(`${pos.x},${pos.y},${pos.z}`)) {
            creations.push(
              world.createEntity([
                new TerrainBlock(),
                new Position(pos),
                new Renderable({ geometry: 'box', blockType: 'water' }),
              ]),
            );
          }
          h += 1;
        }
        const waterExistsHere: boolean = v < WATER_LEVEL;

        // --- Terrain & Tree Generation ---
        for (let d = -8; d < WORLD_DEPTH; d++) {
          const y: number = v - d;
          if (y < MIN_WORLD_Y) continue;

          const pos = { x, y, z };
          if (destroyedSet.has(`${pos.x},${pos.y},${pos.z}`)) {
            continue;
          }

          if (d >= 0) {
            // Underground and surface
            for (const rule of blockGenerationRules) {
              if (
                rule.range.includes(d) &&
                rule.biomes.includes(currentBiome)
              ) {
                creations.push(
                  world.createEntity([
                    new TerrainBlock(),
                    new Position(pos),
                    new Renderable({
                      geometry: 'box',
                      blockType: rule.name,
                    }),
                  ]),
                );
                break; // First matching rule wins
              }
            }
          } else {
            // Above ground (Trees)
            if (currentBiome === 'plains' && !waterExistsHere) {
              // LOGS
              if (parseFloat(treeNoise.toFixed(3)) === 0.001) {
                if (d < 0 && d >= -8) {
                  const blockType = d !== -8 ? 'oakLog' : 'oakLeaves';
                  creations.push(
                    world.createEntity([
                      new TerrainBlock(),
                      new Position(pos),
                      new Renderable({ geometry: 'box', blockType }),
                    ]),
                  );
                }
              }
              // LEAVES
              let canPutLeaf = false;
              for (let xInc = -1; xInc < 2; xInc += 1) {
                for (let zInc = -1; zInc < 2; zInc += 1) {
                  if (xInc === 0 && zInc === 0) continue;
                  const treeNoiseAround = noise.perlin2(
                    inc * (x + xInc),
                    inc * (z + zInc),
                  );
                  if (parseFloat(treeNoiseAround.toFixed(3)) === 0.001) {
                    canPutLeaf = true;
                    break;
                  }
                }
                if (canPutLeaf) break;
              }

              if (d <= -6 && canPutLeaf) {
                if (parseFloat(treeNoise.toFixed(3)) !== 0.001) {
                  creations.push(
                    world.createEntity([
                      new TerrainBlock(),
                      new Position(pos),
                      new Renderable({
                        geometry: 'box',
                        blockType: 'oakLeaves',
                      }),
                    ]),
                  );
                }
              }
            }
          }
        }
      }
    }

    // Add placed blocks for this chunk
    for (const block of placed) {
      if (
        block.x >= startX &&
        block.x < startX + CHUNK_SIZE &&
        block.z >= startZ &&
        block.z < startZ + CHUNK_SIZE
      ) {
        creations.push(
          world.createEntity([
            new TerrainBlock(),
            new Position({ x: block.x, y: block.y, z: block.z }),
            new Renderable({
              geometry: 'box',
              blockType: block.blockType,
            }),
          ]),
        );
      }
    }

    yield* _(Effect.all(creations, { discard: true, concurrency: 'inherit' }));
  });

export const generationSystem: Effect.Effect<void, never, GameState | World> =
  Effect.gen(function* (_) {
    // Generate initial chunks around the origin
    for (let x = -RENDER_DISTANCE / 2; x < RENDER_DISTANCE / 2; x++) {
      for (let z = -RENDER_DISTANCE / 2; z < RENDER_DISTANCE / 2; z++) {
        yield* _(generateChunk(x, z));
      }
    }
  }).pipe(Effect.withSpan('generationSystem'));
