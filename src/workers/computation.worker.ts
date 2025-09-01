import * as noise from 'perlin-noise';
import { match } from 'ts-pattern';
import { BlockType } from '../domain/block';
import type {
  BlockData,
  ChunkGenerationResult,
  GenerationParams,
  ChunkMeshData,
  PlacedBlock,
} from '../domain/types';

// --- Constants and Configuration ---

const CHUNK_SIZE = 10;
const CHUNK_HEIGHT = 256;
const WATER_LEVEL = 0;
const WORLD_DEPTH = 5;
const MIN_WORLD_Y = -250;
const Y_OFFSET = 128; // Used to map world Y coordinates to array indices

const ATLAS_CONFIG = {
  widthInTiles: 4,
  get tileSize() {
    return 1 / this.widthInTiles;
  },
} as const;

// --- Type Definitions ---

type Biome = 'plains' | 'desert';
type FaceName = 'top' | 'bottom' | 'side';
type Position = { readonly x: number; readonly y: number; readonly z: number };

// --- Texture Atlas Mapping ---

const textureMap: Record<BlockType, Partial<Record<FaceName, [number, number]>>> =
  {
    grass: { top: [0, 0], side: [1, 0], bottom: [2, 0] },
    dirt: { side: [2, 0] },
    sand: { side: [0, 1] },
    stone: { side: [1, 1] },
    cobblestone: { side: [2, 1] },
    water: { side: [3, 1] },
    oakLog: { top: [0, 2], side: [1, 2], bottom: [0, 2] },
    oakLeaves: { side: [2, 2] },
    glass: { side: [3, 2] },
    brick: { side: [0, 3] },
    plank: { side: [1, 3] },
  };

const getUvForFace = (
  blockType: BlockType,
  faceName: 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west',
): [number, number] => {
  const faces = textureMap[blockType] ?? textureMap.stone;
  const sideUv = faces.side ?? textureMap.stone.side!;

  return match(faceName)
    .with('top', () => faces.top ?? sideUv)
    .with('bottom', () => faces.bottom ?? sideUv)
    .otherwise(() => sideUv);
};

// --- Terrain Generation ---

const blockGenerationRules = [
  { type: 'grass', range: [0], biomes: ['plains'] },
  { type: 'dirt', range: [1, 2], biomes: ['plains'] },
  { type: 'sand', range: [0, 1, 2], biomes: ['desert'] },
  { type: 'stone', range: [3, 4], biomes: ['plains', 'desert'] },
  { type: 'cobblestone', range: [3, 4], biomes: ['plains', 'desert'] },
] as const;

const getBiome = (noiseValue: number): Biome =>
  noiseValue < 0.2 ? 'plains' : 'desert';

const hashPosition = (pos: Position): string => `${pos.x},${pos.y},${pos.z}`;

const createNoiseFunctions = (seeds: GenerationParams['seeds']) => {
  const createNoise = (seed: number) => (x: number, z: number) => {
    noise.seed(seed);
    return noise.perlin2(x, z);
  };
  return {
    world: createNoise(seeds.world),
    biome: createNoise(seeds.biome),
    trees: createNoise(seeds.trees),
  };
};

const generateTerrain = (
  params: GenerationParams,
  destroyedBlocks: Set<string>,
): BlockData[] => {
  const { chunkX, chunkZ, seeds, amplitude } = params;
  const noiseFuncs = createNoiseFunctions(seeds);
  const blocks: BlockData[] = [];
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;
  const noiseIncrement = 0.05;

  for (let x = startX; x < startX + CHUNK_SIZE; x++) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
      const xOff = noiseIncrement * x;
      const zOff = noiseIncrement * z;

      const terrainHeight = Math.round(
        noiseFuncs.world(xOff, zOff) * amplitude,
      );
      const currentBiome = getBiome(noiseFuncs.biome(xOff, zOff));

      // Generate water
      for (let y = terrainHeight + 1; y <= WATER_LEVEL; y++) {
        const pos = { x, y, z };
        if (!destroyedBlocks.has(hashPosition(pos))) {
          blocks.push({ ...pos, blockType: 'water' });
        }
      }

      // Generate terrain and trees
      for (let depth = 0; depth < WORLD_DEPTH; depth++) {
        const y = terrainHeight - depth;
        if (y < MIN_WORLD_Y) continue;

        const pos = { x, y, z };
        if (destroyedBlocks.has(hashPosition(pos))) continue;

        const rule = blockGenerationRules.find(
          (r) =>
            r.range.includes(depth) &&
            (r.biomes as ReadonlyArray<string>).includes(currentBiome),
        );
        if (rule) {
          blocks.push({ ...pos, blockType: rule.type });
        }
      }
    }
  }
  return blocks;
};

const applyUserEdits = (
  blocks: BlockData[],
  editedBlocks: GenerationParams['editedBlocks'],
  chunkX: number,
  chunkZ: number,
): BlockData[] => {
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;

  const placedBlocksInChunk = editedBlocks.placed.filter(
    (block) =>
      block.x >= startX &&
      block.x < startX + CHUNK_SIZE &&
      block.z >= startZ &&
      block.z < startZ + CHUNK_SIZE,
  );

  return [...blocks, ...placedBlocksInChunk];
};

const generateBlockData = (params: GenerationParams): BlockData[] => {
  const destroyedBlocks = new Set(
    params.editedBlocks.destroyed.map(hashPosition),
  );
  const terrainBlocks = generateTerrain(params, destroyedBlocks);
  return applyUserEdits(
    terrainBlocks,
    params.editedBlocks,
    params.chunkX,
    params.chunkZ,
  );
};

// --- Mesh Generation ---

export const isOpaque = (blockType?: BlockType): boolean =>
  blockType !== undefined && blockType !== 'water' && blockType !== 'glass';

const createChunkDataView = (
  blocks: ReadonlyArray<BlockData>,
  startX: number,
  startZ: number,
): (BlockType | undefined)[][][] => {
  const chunkBlocks = Array.from({ length: CHUNK_SIZE }, () =>
    Array.from({ length: CHUNK_HEIGHT }, () =>
      Array.from({ length: CHUNK_SIZE }, (): BlockType | undefined => undefined),
    ),
  );

  for (const block of blocks) {
    const localX = block.x - startX;
    const localZ = block.z - startZ;
    const yIndex = block.y + Y_OFFSET;

    if (
      localX >= 0 &&
      localX < CHUNK_SIZE &&
      localZ >= 0 &&
      localZ < CHUNK_SIZE &&
      yIndex >= 0 &&
      yIndex < CHUNK_HEIGHT
    ) {
      chunkBlocks[localX]![yIndex]![localZ] = block.blockType;
    }
  }
  return chunkBlocks;
};

const getBlockFromChunkView = (
  chunkView: (BlockType | undefined)[][][],
  x: number,
  y: number,
  z: number,
): BlockType | undefined => {
  if (
    x < 0 ||
    x >= CHUNK_SIZE ||
    y < 0 ||
    y >= CHUNK_HEIGHT ||
    z < 0 ||
    z >= CHUNK_SIZE
  ) {
    return undefined;
  }
  return chunkView[x]?.[y]?.[z];
};

export const generateGreedyMesh = (
  blocks: ReadonlyArray<BlockData>,
  chunkX: number,
  chunkZ: number,
): ChunkMeshData => {
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;
  const chunkBlocks = createChunkDataView(blocks, startX, startZ);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  // Iterate over each dimension (x, y, z)
  for (let dimension = 0; dimension < 3; dimension++) {
    console.log(`Processing dimension: ${dimension}`);
    const initialVertexCount = positions.length;
    // Iterate over each side (positive and negative)
    for (let side = -1; side <= 1; side += 2) {
      const u_axis = (dimension + 1) % 3;
      const v_axis = (dimension + 2) % 3;
      const pos: [number, number, number] = [0, 0, 0];
      const dir: [number, number, number] = [0, 0, 0];
      dir[dimension] = side;

      const mask = new Array<BlockType | null>(CHUNK_SIZE * CHUNK_HEIGHT).fill(
        null,
      );

      // Iterate over the current dimension
      for (pos[dimension] = -1; pos[dimension] < CHUNK_SIZE; ) {
        let mask_idx = 0;
        // Create a 2D mask of the current slice
        for (pos[v_axis] = 0; pos[v_axis] < CHUNK_HEIGHT; pos[v_axis]++) {
          for (pos[u_axis] = 0; pos[u_axis] < CHUNK_SIZE; pos[u_axis]++) {
            const block1 = getBlockFromChunkView(
              chunkBlocks,
              pos[0],
              pos[1],
              pos[2],
            );
            const block2 = getBlockFromChunkView(
              chunkBlocks,
              pos[0] + dir[0],
              pos[1] + dir[1],
              pos[2] + dir[2],
            );
            const opaque1 = isOpaque(block1);
            const opaque2 = isOpaque(block2);

            mask[mask_idx++] =
              opaque1 === opaque2 ? null : opaque1 ? block1! : block2!;
          }
        }
        pos[dimension]++;

        mask_idx = 0;
        // Generate mesh from the mask
        for (let row = 0; row < CHUNK_HEIGHT; row++) {
          for (let col = 0; col < CHUNK_SIZE; ) {
            if (mask[mask_idx]) {
              const blockType = mask[mask_idx]!;
              // Calculate width of the quad
              let width = 1;
              while (
                col + width < CHUNK_SIZE &&
                mask[mask_idx + width] === blockType
              )
                width++;

              // Calculate height of the quad
              let height = 1;
              let done = false;
              while (row + height < CHUNK_HEIGHT) {
                for (let k = 0; k < width; k++) {
                  if (mask[mask_idx + k + height * CHUNK_SIZE] !== blockType) {
                    done = true;
                    break;
                  }
                }
                if (done) break;
                height++;
              }

              pos[u_axis] = col;
              pos[v_axis] = row;
              const du: [number, number, number] = [0, 0, 0];
              du[u_axis] = width;
              const dv: [number, number, number] = [0, 0, 0];
              dv[v_axis] = height;

              const faceName =
                dimension === 0
                  ? side > 0
                    ? 'east'
                    : 'west'
                  : dimension === 1
                    ? side > 0
                      ? 'top'
                      : 'bottom'
                    : side > 0
                      ? 'south'
                      : 'north';
              const tileUv = getUvForFace(blockType, faceName);

              positions.push(
                pos[0] + startX,
                pos[1] - Y_OFFSET,
                pos[2] + startZ,
                pos[0] + du[0] + startX,
                pos[1] + du[1] - Y_OFFSET,
                pos[2] + du[2] + startZ,
                pos[0] + du[0] + dv[0] + startX,
                pos[1] + du[1] + dv[1] - Y_OFFSET,
                pos[2] + du[2] + dv[2] + startZ,
                pos[0] + dv[0] + startX,
                pos[1] + dv[1] - Y_OFFSET,
                pos[2] + dv[2] + startZ,
              );

              normals.push(
                dir[0],
                dir[1],
                dir[2],
                dir[0],
                dir[1],
                dir[2],
                dir[0],
                dir[1],
                dir[2],
                dir[0],
                dir[1],
                dir[2],
              );

              const u0 = tileUv[0] * ATLAS_CONFIG.tileSize;
              const v0 = 1.0 - (tileUv[1] + 1) * ATLAS_CONFIG.tileSize;
              const u1 = (tileUv[0] + width) * ATLAS_CONFIG.tileSize;
              const v1 =
                1.0 - (tileUv[1] + 1 - height) * ATLAS_CONFIG.tileSize;
              uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);

              indices.push(
                vertexIndex,
                vertexIndex + 1,
                vertexIndex + 2,
                vertexIndex,
                vertexIndex + 2,
                vertexIndex + 3,
              );
              vertexIndex += 4;

              // Zero out the mask for the processed quad
              for (let l = 0; l < height; l++) {
                for (let k = 0; k < width; k++) {
                  mask[mask_idx + k + l * CHUNK_SIZE] = null;
                }
              }
              col += width;
              mask_idx += width;
            } else {
              col++;
              mask_idx++;
            }
          }
        }
      }
    }
    console.log(`Vertices added for dimension ${dimension}: ${(positions.length - initialVertexCount) / 3}`);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
};

// --- Worker Entry Point ---

export const generateChunk = (
  params: GenerationParams,
): ChunkGenerationResult => {
  const blocks = generateBlockData(params);
  const mesh = generateGreedyMesh(blocks, params.chunkX, params.chunkZ);
  return {
    blocks,
    mesh,
    chunkX: params.chunkX,
    chunkZ: params.chunkZ,
  };
};

export type GenerateChunkTask = {
  readonly type: 'generateChunk';
  readonly payload: GenerationParams;
};
export type ComputationTask = GenerateChunkTask;

export const messageHandler = (e: MessageEvent<ComputationTask>) => {
  match(e.data)
    .with({ type: 'generateChunk' }, (task) => {
      const result = generateChunk(task.payload);
      const transferables = [
        result.mesh.positions.buffer,
        result.mesh.normals.buffer,
        result.mesh.uvs.buffer,
        result.mesh.indices.buffer,
      ];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      self.postMessage(result, { transfer: transferables });
    })
    .otherwise(() => {
      // In a real app, post an error message back to the main thread.
    });
};

// Binds the message handler if running in a web worker context.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof self !== 'undefined' && 'onmessage' in self) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  self.onmessage = messageHandler;
}