/**
 * Generates a unique string ID for a chunk based on its coordinates.
 * @param x The x-coordinate of the chunk.
 * @param z The z-coordinate of the chunk.
 * @returns A string in the format "x,z".
 */
export const getChunkId = (x: number, z: number): string => `${x},${z}`;
