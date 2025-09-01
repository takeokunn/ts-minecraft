import * as noise from 'perlin-noise';
import { match } from 'ts-pattern';
import {
  BlockType,
  FaceName,
  getUvForFace,
  isBlockTransparent,
  TILE_SIZE,
} from '../domain/block';
import {
  ChunkGenerationResult,
  GenerationParams,
  PlacedBlock,
} from '../domain/types';
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  MIN_WORLD_Y,
  WATER_LEVEL,
  WORLD_DEPTH,
  Y_OFFSET,
} from '../domain/world-constants';

type ChunkMeshData = ChunkGenerationResult['mesh'];

type NoiseFunctions = {
  readonly world: (x: number, z: number) => number;
  readonly biome: (x: number, z: number) => number;
  readonly trees: (x: number, z: number) => number;
};

const createNoiseFunctions = (
  seeds: GenerationParams['seeds'],
): NoiseFunctions => {
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

const getBlockTypeForDepth = (
  depth: number,
  biome: 'plains' | 'desert',
): BlockType | null => {
  if (depth === 0) return biome === 'plains' ? 'grass' : 'sand';
  if (depth <= 2) return biome === 'plains' ? 'dirt' : 'sand';
  if (depth <= 4) return 'stone';
  return null;
};

const generateTerrainColumn = (
  x: number,
  z: number,
  noiseFuncs: NoiseFunctions,
  amplitude: number,
  destroyedBlocks: GenerationParams['editedBlocks']['destroyed'],
): PlacedBlock[] => {
  const columnBlocks: PlacedBlock[] = [];
  const noiseIncrement = 0.05;
  const xOff = noiseIncrement * x;
  const zOff = noiseIncrement * z;

  const terrainHeight = Math.round(noiseFuncs.world(xOff, zOff) * amplitude);
  const biome = noiseFuncs.biome(xOff, zOff) < 0.2 ? 'plains' : 'desert';

  for (let depth = 0; depth < WORLD_DEPTH; depth++) {
    const y = terrainHeight - depth;
    if (y < MIN_WORLD_Y) continue;
    const position = { x, y, z };
    if (destroyedBlocks.has(`${x},${y},${z}`)) continue;

    const blockType = getBlockTypeForDepth(depth, biome);
    if (blockType) {
      columnBlocks.push({ position, blockType });
    }
  }

  for (let y = terrainHeight + 1; y <= WATER_LEVEL; y++) {
    const position = { x, y, z };
    if (!destroyedBlocks.has(`${x},${y},${z}`)) {
      columnBlocks.push({ position, blockType: 'water' });
    }
  }

  return columnBlocks;
};

const generateBlockData = (params: GenerationParams): PlacedBlock[] => {
  const { chunkX, chunkZ, seeds, amplitude, editedBlocks } = params;
  const noiseFuncs = createNoiseFunctions(seeds);
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;

  let blocks: PlacedBlock[] = [];
  for (let x = startX; x < startX + CHUNK_SIZE; x++) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
      blocks.push(
        ...generateTerrainColumn(
          x,
          z,
          noiseFuncs,
          amplitude,
          editedBlocks.destroyed,
        ),
      );
    }
  }

  for (const block of Object.values(editedBlocks.placed)) {
    const { position } = block;
    if (
      position.x >= startX &&
      position.x < startX + CHUNK_SIZE &&
      position.z >= startZ &&
      position.z < startZ + CHUNK_SIZE
    ) {
      blocks = blocks.filter(
        (b) =>
          b.position.x !== position.x ||
          b.position.y !== position.y ||
          b.position.z !== position.z,
      );
      blocks.push(block);
    }
  }

  return blocks;
};

type ChunkView = (BlockType | undefined)[][][];

const createChunkDataView = (
  blocks: ReadonlyArray<PlacedBlock>,
  startX: number,
  startZ: number,
): ChunkView => {
  const view: ChunkView = Array.from({ length: CHUNK_SIZE }, () =>
    Array.from({ length: CHUNK_HEIGHT }, () =>
      new Array(CHUNK_SIZE).fill(undefined),
    ),
  );
  for (const { position, blockType } of blocks) {
    const localX = position.x - startX;
    const localZ = position.z - startZ;
    const yIndex = position.y + Y_OFFSET;
    if (
      localX >= 0 &&
      localX < CHUNK_SIZE &&
      localZ >= 0 &&
      localZ < CHUNK_SIZE &&
      yIndex >= 0 &&
      yIndex < CHUNK_HEIGHT
    ) {
      const x = view[localX];
      if (x) {
        const y = x[yIndex];
        if (y) {
          y[localZ] = blockType;
        }
      }
    }
  }
  return view;
};

const getBlock = (
  view: ChunkView,
  x: number,
  y: number,
  z: number,
): BlockType | undefined => {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return undefined;
  }
  return view[x]?.[y]?.[z];
};

export const generateGreedyMesh = (
  blocks: ReadonlyArray<PlacedBlock>,
  chunkX: number,
  chunkZ: number,
): ChunkMeshData => {
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;
  const chunkView = createChunkDataView(blocks, startX, startZ);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexIndex = 0;

  const dims: [number, number, number] = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE];
  const pos: [number, number, number] = [0, 0, 0];

  for (let d = 0; d < 3; d++) {
    for (pos[d] = -1; pos[d]! < dims[d]!; pos[d]!++) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;
      const dir: [number, number, number] = [0, 0, 0];
      for (let s = -1; s <= 1; s += 2) {
        dir[d] = s;
        const mask = new Array<BlockType | null>(dims[u]! * dims[v]!).fill(
          null,
        );
        let maskIdx = 0;

        for (pos[v] = 0; pos[v] < dims[v]!; ++pos[v]) {
          for (pos[u] = 0; pos[u] < dims[u]!; ++pos[u]) {
            const b1 = getBlock(chunkView, pos[0], pos[1], pos[2]);
            const b2 = getBlock(chunkView, pos[0] + (d === 0 ? s : 0), pos[1] + (d === 1 ? s : 0), pos[2] + (d === 2 ? s : 0));
            const t1 = b1 && !isBlockTransparent(b1);
            const t2 = b2 && !isBlockTransparent(b2);
            mask[maskIdx++] = t1 === t2 ? null : t1 ? b1 : (b2 ?? null);
          }
        }

        maskIdx = 0;
        for (let j = 0; j < dims[v]!; j++) {
          for (let i = 0; i < dims[u]!; ) {
            if (mask[maskIdx]) {
              const blockType = mask[maskIdx]!;
              let w = 1;
              while (i + w < dims[u]! && mask[maskIdx + w] === blockType) w++;
              let h = 1;
              let done = false;
              while (j + h < dims[v]!) {
                for (let k = 0; k < w; k++) {
                  if (mask[maskIdx + k + h * dims[u]!] !== blockType) {
                    done = true;
                    break;
                  }
                }
                if (done) break;
                h++;
              }

              pos[u] = i;
              pos[v] = j;
              const du: [number, number, number] = [0, 0, 0];
              du[u] = w;
              const dv: [number, number, number] = [0, 0, 0];
              dv[v] = h;

              const faceName: FaceName = match(d)
                .with(0, () => (s > 0 ? 'east' : 'west'))
                .with(1, () => (s > 0 ? 'top' : 'bottom'))
                .with(2, () => (s > 0 ? 'north' : 'south'))
                .otherwise(() => {
                  throw new Error('Invalid dimension');
                });
              const tileUv = getUvForFace(blockType, faceName);

              positions.push(
                pos[0] + startX, pos[1], pos[2] + startZ,
                pos[0] + du[0] + startX, pos[1] + du[1], pos[2] + du[2] + startZ,
                pos[0] + du[0] + dv[0] + startX, pos[1] + du[1] + dv[1], pos[2] + du[2] + dv[2] + startZ,
                pos[0] + dv[0] + startX, pos[1] + dv[1], pos[2] + dv[2] + startZ,
              );
              normals.push(dir[0], dir[1], dir[2], dir[0], dir[1], dir[2], dir[0], dir[1], dir[2], dir[0], dir[1], dir[2]);
              
              const u0 = tileUv[0] * TILE_SIZE;
              const v0 = 1.0 - (tileUv[1] + 1) * TILE_SIZE;
              const u1 = (tileUv[0] + w) * TILE_SIZE;
              const v1 = 1.0 - (tileUv[1] + h) * TILE_SIZE;
              uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);

              indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3);
              vertexIndex += 4;

              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) {
                  mask[maskIdx + k + l * dims[u]!] = null;
                }
              }
              i += w;
              maskIdx += w;
            } else {
              i++;
              maskIdx++;
            }
          }
        }
      }
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
};

export const generateChunk = (params: GenerationParams): ChunkGenerationResult => {
  const blocks = generateBlockData(params);
  const mesh = generateGreedyMesh(blocks, params.chunkX, params.chunkZ);
  return {
    blocks,
    mesh,
    chunkX: params.chunkX,
    chunkZ: params.chunkZ,
  };
};

export type ComputationTask = {
  readonly type: 'generateChunk';
  readonly payload: GenerationParams;
};

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
      self.postMessage(result, { transfer: transferables });
    })
    .exhaustive();
};

if (typeof self !== 'undefined' && 'onmessage' in self) {
  self.onmessage = messageHandler;
}