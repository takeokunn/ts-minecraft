
import * as noise from 'perlin-noise';
import { BlockType } from '../domain/block';
import { faces, indices as faceIndices, uvs as faceUvs, vertices as cubeVertices } from '../domain/geometry';

// --- TYPE DEFINITIONS ---

const CHUNK_SIZE = 10;
const WATER_LEVEL = 0;
const WORLD_DEPTH = 5;
const MIN_WORLD_Y = -250;

type Biome = 'plains' | 'desert';

// A simplified version of the component for the worker
type DestroyedBlock = { x: number; y: number; z: number };

export interface GenerationParams {
  chunkX: number;
  chunkZ: number;
  seeds: {
    world: number;
    biome: number;
    trees: number;
  };
  amplitude: number;
  editedBlocks: {
    destroyed: DestroyedBlock[];
    placed: any[]; // Define a proper type for placed blocks
  };
}

export interface BlockData {
  x: number;
  y: number;
  z: number;
  blockType: BlockType;
}

export interface ChunkMeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface ChunkGenerationResult {
  blocks: ReadonlyArray<BlockData>;
  mesh: ChunkMeshData;
  chunkX: number;
  chunkZ: number;
}

// --- MESH GENERATION LOGIC ---

const blockGenerationRules: ReadonlyArray<{
  name: BlockType;
  range: ReadonlyArray<number>;
  biomes: ReadonlyArray<Biome>;
}> = [
  { name: 'grass', range: [0], biomes: ['plains'] },
  { name: 'dirt', range: [1, 2], biomes: ['plains'] },
  { name: 'sand', range: [0, 1, 2], biomes: ['desert'] },
  { name: 'stone', range: [3, 4], biomes: ['plains', 'desert'] },
  { name: 'cobblestone', range: [3, 4], biomes: ['plains', 'desert'] },
];

function getBiome(n: number): Biome {
  if (n < 0.2) {
    return 'plains';
  } else {
    return 'desert';
  }
}

// Simple check for transparent blocks
// Simple check for transparent blocks. In Greedy Meshing, we treat air (undefined)
// and transparent blocks differently from opaque blocks.
function isOpaque(blockType: BlockType | undefined): boolean {
  if (!blockType) return false; // air is not opaque
  return blockType !== 'water' && blockType !== 'glass';
}

function generateChunk(params: GenerationParams): ChunkGenerationResult {
  const { chunkX, chunkZ, seeds, amplitude, editedBlocks } = params;
  const { world: worldSeed, biome, trees } = seeds;
  const { destroyed, placed } = editedBlocks;

  const blocks: BlockData[] = [];
  const destroyedSet: Set<string> = new Set(
    destroyed.map((b) => `${b.x},${b.y},${b.z}`),
  );

  const startX: number = chunkX * CHUNK_SIZE;
  const startZ: number = chunkZ * CHUNK_SIZE;
  const inc = 0.05;

  // --- 1. Generate Block Data (largely the same) ---
  for (let x = startX; x < startX + CHUNK_SIZE; x++) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
      const xoff: number = inc * x;
      const zoff: number = inc * z;

      noise.seed(worldSeed);
      const v: number =
        Math.round((noise.perlin2(xoff, zoff) * amplitude) / 1) * 1;

      noise.seed(biome);
      const currentBiome: Biome = getBiome(noise.perlin2(xoff / 1, zoff / 1));

      noise.seed(trees);
      const treeNoise: number = noise.perlin2(xoff / 1, zoff / 1);

      let h = 1;
      while (v + h <= WATER_LEVEL) {
        const pos = { x, y: v + h, z };
        if (!destroyedSet.has(`${pos.x},${pos.y},${pos.z}`)) {
          blocks.push({ ...pos, blockType: 'water' });
        }
        h += 1;
      }
      const waterExistsHere: boolean = v < WATER_LEVEL;

      for (let d = -8; d < WORLD_DEPTH; d++) {
        const y: number = v - d;
        if (y < MIN_WORLD_Y) continue;
        const pos = { x, y, z };
        if (destroyedSet.has(`${pos.x},${pos.y},${pos.z}`)) continue;

        if (d >= 0) {
          for (const rule of blockGenerationRules) {
            if (
              rule.range.includes(d) &&
              rule.biomes.includes(currentBiome)
            ) {
              blocks.push({ ...pos, blockType: rule.name });
              break;
            }
          }
        } else {
          if (currentBiome === 'plains' && !waterExistsHere) {
            if (parseFloat(treeNoise.toFixed(3)) === 0.001) {
              if (d < 0 && d >= -8) {
                const blockType = d !== -8 ? 'oakLog' : 'oakLeaves';
                blocks.push({ ...pos, blockType });
              }
            }
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
                blocks.push({ ...pos, blockType: 'oakLeaves' });
              }
            }
          }
        }
      }
    }
  }

  // Add placed blocks
  for (const block of placed) {
    if (
      block.x >= startX &&
      block.x < startX + CHUNK_SIZE &&
      block.z >= startZ &&
      block.z < startZ + CHUNK_SIZE
    ) {
      blocks.push({
        x: block.x,
        y: block.y,
        z: block.z,
        blockType: block.blockType,
      });
    }
  }

  // --- 2. Generate Mesh using Greedy Meshing ---

  // For faster access, convert block data into a 3D array using local chunk coordinates
  const chunkBlocks = new Array(CHUNK_SIZE)
    .fill(0)
    .map(() =>
      new Array(256)
        .fill(0)
        .map(() => new Array(CHUNK_SIZE).fill(undefined)),
    );

  for (const block of blocks) {
    const localX = block.x - startX;
    const localY = block.y; // Assuming y is global for now, adjust if needed
    const localZ = block.z - startZ;
    if (
      localX >= 0 &&
      localX < CHUNK_SIZE &&
      localZ >= 0 &&
      localZ < CHUNK_SIZE
    ) {
      // A simple way to handle potential negative y values
      const yIndex = localY + 128;
      if (yIndex >= 0 && yIndex < 256) {
        chunkBlocks[localX][yIndex][localZ] = block.blockType;
      }
    }
  }

  const getBlock = (x: number, y: number, z: number) => {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return undefined;
    const yIndex = y + 128;
    if (yIndex < 0 || yIndex >= 256) return undefined;
    return chunkBlocks[x][yIndex][z];
  };

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  // Iterate over the 6 directions (3 axes, 2 sides per axis)
  for (let d = 0; d < 3; d++) {
    for (let s = -1; s <= 1; s += 2) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;

      const x = [0, 0, 0];
      const q = [0, 0, 0];
      q[d] = s;

      const mask = new Array(CHUNK_SIZE * 256).fill(null);

      for (x[d] = -1; x[d] < CHUNK_SIZE; ) {
        let n = 0;
        for (x[v] = 0; x[v] < 256; x[v]++) {
          for (x[u] = 0; x[u] < CHUNK_SIZE; x[u]++) {
            const block1 = getBlock(x[0], x[1] - 128, x[2]);
            const block2 = getBlock(
              x[0] + q[0],
              x[1] - 128 + q[1],
              x[2] + q[2],
            );

            const opaque1 = isOpaque(block1);
            const opaque2 = isOpaque(block2);

            if ((opaque1 && !opaque2) || (!opaque1 && block1 && !opaque2)) {
              mask[n] = block1;
            } else if (
              (opaque2 && !opaque1) ||
              (!opaque2 && block2 && !opaque1)
            ) {
              mask[n] = block2;
            }
            n++;
          }
        }
        x[d]++;

        n = 0;
        for (let j = 0; j < 256; j++) {
          for (let i = 0; i < CHUNK_SIZE; ) {
            if (mask[n]) {
              const blockType = mask[n];
              let w = 1;
              while (
                i + w < CHUNK_SIZE &&
                mask[n + w] &&
                mask[n + w] === blockType
              ) {
                w++;
              }

              let h = 1;
              let done = false;
              while (j + h < 256) {
                for (let k = 0; k < w; k++) {
                  if (
                    !mask[n + k + h * CHUNK_SIZE] ||
                    mask[n + k + h * CHUNK_SIZE] !== blockType
                  ) {
                    done = true;
                    break;
                  }
                }
                if (done) break;
                h++;
              }

              x[u] = i;
              x[v] = j;

              const du = [0, 0, 0];
              du[u] = w;
              const dv = [0, 0, 0];
              dv[v] = h;

              const faceName =
                d === 0
                  ? s > 0
                    ? 'east'
                    : 'west'
                  : d === 1
                    ? s > 0
                      ? 'top'
                      : 'bottom'
                    : s > 0
                      ? 'south'
                      : 'north';
              const tileUv = getUvForFace(blockType, faceName);

              positions.push(
                x[0] + startX,
                x[1] - 128,
                x[2] + startZ,
                x[0] + du[0] + startX,
                x[1] + du[1] - 128,
                x[2] + du[2] + startZ,
                x[0] + du[0] + dv[0] + startX,
                x[1] + du[1] + dv[1] - 128,
                x[2] + du[2] + dv[2] + startZ,
                x[0] + dv[0] + startX,
                x[1] + dv[1] - 128,
                x[2] + dv[2] + startZ,
              );

              normals.push(
                q[0],
                q[1],
                q[2],
                q[0],
                q[1],
                q[2],
                q[0],
                q[1],
                q[2],
                q[0],
                q[1],
                q[2],
              );

              const u0 = tileUv[0] * TILE_SIZE;
              const v0 = 1.0 - (tileUv[1] + 1) * TILE_SIZE;
              const u1 = (tileUv[0] + w) * TILE_SIZE;
              const v1 = 1.0 - (tileUv[1] + 1 - h) * TILE_SIZE;

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

              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) {
                  mask[n + k + l * CHUNK_SIZE] = null;
                }
              }
              i += w;
              n += w;
            } else {
              i++;
              n++;
            }
          }
        }
      }
    }
  }

  return {
    blocks,
    mesh: {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
    },
    chunkX,
    chunkZ,
  };
}

// --- Task & Result Types ---

export type GenerateChunkTask = {
  readonly type: 'generateChunk';
  readonly payload: GenerationParams;
};
export type GenerateChunkResult = ChunkGenerationResult;

// Future tasks can be added here
// export type CalculatePathTask = { type: 'calculatePath', payload: PathParams };
// export type CalculatePathResult = PathResult;

export type ComputationTask = GenerateChunkTask; // | CalculatePathTask;
export type ComputationResult = GenerateChunkResult; // | CalculatePathResult;

// --- Worker Logic ---

self.onmessage = (e: MessageEvent<ComputationTask>) => {
  const task = e.data;
  let result: ComputationResult;

  switch (task.type) {
    case 'generateChunk': {
      result = generateChunk(task.payload);
      // Post the result, transferring ownership of the large array buffers
      self.postMessage(result, [
        result.mesh.positions.buffer,
        result.mesh.normals.buffer,
        result.mesh.uvs.buffer,
        result.mesh.indices.buffer,
      ]);
      break;
    }
    // Add other task handlers here
  }
};
