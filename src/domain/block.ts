import { Schema } from 'effect';

export const blockTypes = {
  grass: null,
  dirt: null,
  stone: null,
  cobblestone: null,
  oakLog: null,
  oakLeaves: null,
  sand: null,
  water: null,
  glass: null,
  brick: null,
  plank: null,
} as const;

export const BlockTypeSchema = Schema.Union(
  ...Object.keys(blockTypes).map((k) => Schema.Literal(k)),
);
export type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>;
