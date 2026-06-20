import { CHUNK_SIZE, type ChunkCoord } from "@ts-minecraft/core";
import {
  LIGHT_BYTE_LENGTH,
  computeBlockLight,
  computeSkyLight,
} from "@ts-minecraft/block/domain/light";

export type ChunkBlocks = Readonly<{
  blocks: Uint8Array;
  skyLight: Uint8Array;
  blockLight: Uint8Array;
}>;

export type ColumnNoiseCoord = Readonly<{
  wx: number;
  wz: number;
}>;

export const computeInitialLightGrids = (
  blocks: Uint8Array,
): { skyLight: Uint8Array; blockLight: Uint8Array } => {
  const skyLight = new Uint8Array(LIGHT_BYTE_LENGTH);
  const blockLight = new Uint8Array(LIGHT_BYTE_LENGTH);
  // The flood fills are pure and mutate only the provided output buffers.
  computeSkyLight(blocks, skyLight);
  computeBlockLight(blocks, blockLight);
  return { skyLight, blockLight };
};

export const createTerrainNoiseCoordinates = (
  coord: ChunkCoord,
): ReadonlyArray<ColumnNoiseCoord> => {
  const baseX = coord.x * CHUNK_SIZE;
  const baseZ = coord.z * CHUNK_SIZE;
  const coords: ColumnNoiseCoord[] = [];
  coords.length = CHUNK_SIZE * CHUNK_SIZE;

  let index = 0;
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    const wx = baseX + lx;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      coords[index++] = { wx, wz: baseZ + lz };
    }
  }

  return coords;
};

export const toChunkBlocks = (chunk: { blocks: Uint8Array }): ChunkBlocks => {
  const { skyLight, blockLight } = computeInitialLightGrids(chunk.blocks);
  return { blocks: chunk.blocks, skyLight, blockLight };
};
