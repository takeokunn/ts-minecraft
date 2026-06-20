import type { Position } from "@ts-minecraft/core";

export type PlacedBlock = {
  readonly lx: number;
  readonly y: number;
  readonly lz: number;
  readonly position: Position;
};

export type DirtyVoxel = {
  readonly lx: number;
  readonly y: number;
  readonly lz: number;
};

export const toPlacedBlock = (
  lx: number,
  y: number,
  lz: number,
  position: Position,
): PlacedBlock => ({ lx, y, lz, position });

export const toDirtyVoxels = (
  placedBlocks: ReadonlyArray<PlacedBlock>,
): Array<DirtyVoxel> => {
  const dirtyVoxels = Array.from({ length: placedBlocks.length }) as Array<DirtyVoxel>;
  for (let i = 0; i < placedBlocks.length; i++) {
    const block = placedBlocks[i]!;
    dirtyVoxels[i] = {
      lx: block.lx,
      y: block.y,
      lz: block.lz,
    };
  }
  return dirtyVoxels;
};
