/**
 * Test fixtures for block definitions
 *
 * These fixtures provide valid and invalid block definitions for testing.
 * They use Effect-TS Schema.make() to ensure type safety and validation.
 */

import { Schema } from 'effect'
import type {
  Block,
  BlockType,
  BlockProperties,
  BlockFace,
  BlockId,
} from '@/domain/block'

/**
 * Valid block definitions for each block type
 */
export const validBlockDefinitions = {
  AIR: {
    id: 'block-air-001' as BlockId,
    type: 'AIR' as BlockType,
    properties: {
      hardness: 0,
      transparency: true,
      solid: false,
      emissive: false,
      friction: 0,
    },
    faces: {
      top: false,
      bottom: false,
      north: false,
      south: false,
      east: false,
      west: false,
    },
  },
  DIRT: {
    id: 'block-dirt-001' as BlockId,
    type: 'DIRT' as BlockType,
    properties: {
      hardness: 0.5,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  STONE: {
    id: 'block-stone-001' as BlockId,
    type: 'STONE' as BlockType,
    properties: {
      hardness: 1.5,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  WOOD: {
    id: 'block-wood-001' as BlockId,
    type: 'WOOD' as BlockType,
    properties: {
      hardness: 2.0,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.5,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  GRASS: {
    id: 'block-grass-001' as BlockId,
    type: 'GRASS' as BlockType,
    properties: {
      hardness: 0.6,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  SAND: {
    id: 'block-sand-001' as BlockId,
    type: 'SAND' as BlockType,
    properties: {
      hardness: 0.5,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.8,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
} as const

/**
 * Invalid block definitions for testing error handling
 */
export const invalidBlockDefinitions = {
  MISSING_TYPE: {
    id: 'block-invalid-001' as BlockId,
    // @ts-expect-error - Missing type
    properties: {
      hardness: 0.5,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  MISSING_PROPERTIES: {
    id: 'block-invalid-002' as BlockId,
    type: 'DIRT' as BlockType,
    // @ts-expect-error - Missing properties
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  MISSING_FACES: {
    id: 'block-invalid-003' as BlockId,
    type: 'DIRT' as BlockType,
    properties: {
      hardness: 0.5,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    },
    // @ts-expect-error - Missing faces
  },
  INVALID_HARDNESS_NEGATIVE: {
    id: 'block-invalid-004' as BlockId,
    type: 'DIRT' as BlockType,
    properties: {
      hardness: -1,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  INVALID_HARDNESS_OVERFLOW: {
    id: 'block-invalid-005' as BlockId,
    type: 'DIRT' as BlockType,
    properties: {
      hardness: 101,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  INVALID_FRICTION_NEGATIVE: {
    id: 'block-invalid-006' as BlockId,
    type: 'DIRT' as BlockType,
    properties: {
      hardness: 0.5,
      transparency: false,
      solid: true,
      emissive: false,
      friction: -0.1,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  INVALID_FRICTION_OVERFLOW: {
    id: 'block-invalid-007' as BlockId,
    type: 'DIRT' as BlockType,
    properties: {
      hardness: 0.5,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 1.1,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  INVALID_TYPE: {
    id: 'block-invalid-008' as BlockId,
    // @ts-expect-error - Invalid block type
    type: 'INVALID' as BlockType,
    properties: {
      hardness: 0.5,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
} as const

/**
 * Edge case block definitions for testing boundary conditions
 */
export const edgeCaseBlockDefinitions = {
  MIN_HARDNESS: {
    id: 'block-edge-001' as BlockId,
    type: 'DIRT' as BlockType,
    properties: {
      hardness: 0,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  MAX_HARDNESS: {
    id: 'block-edge-002' as BlockId,
    type: 'STONE' as BlockType,
    properties: {
      hardness: 100,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 1,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  ALL_FACES_DISABLED: {
    id: 'block-edge-003' as BlockId,
    type: 'AIR' as BlockType,
    properties: {
      hardness: 0,
      transparency: true,
      solid: false,
      emissive: false,
      friction: 0,
    },
    faces: {
      top: false,
      bottom: false,
      north: false,
      south: false,
      east: false,
      west: false,
    },
  },
  ALL_FACES_ENABLED: {
    id: 'block-edge-004' as BlockId,
    type: 'STONE' as BlockType,
    properties: {
      hardness: 1.5,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.6,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  FULLY_EMISSIVE: {
    id: 'block-edge-005' as BlockId,
    type: 'STONE' as BlockType,
    properties: {
      hardness: 1.5,
      transparency: false,
      solid: true,
      emissive: true,
      friction: 0.6,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
  MEDIUM_PROPERTIES: {
    id: 'block-edge-006' as BlockId,
    type: 'DIRT' as BlockType,
    properties: {
      hardness: 50,
      transparency: false,
      solid: true,
      emissive: false,
      friction: 0.5,
    },
    faces: {
      top: true,
      bottom: true,
      north: true,
      south: true,
      east: true,
      west: true,
    },
  },
} as const

/**
 * Helper function to get a valid block of a specific type
 */
export const getValidBlock = (type: BlockType): Record<string, unknown> => {
  return validBlockDefinitions[type as keyof typeof validBlockDefinitions]
}

/**
 * Helper function to get all valid blocks
 */
export const getAllValidBlocks = (): Record<string, unknown>[] => {
  return Object.values(validBlockDefinitions)
}

/**
 * Helper function to get all invalid blocks
 */
export const getAllInvalidBlocks = (): Record<string, unknown>[] => {
  return Object.values(invalidBlockDefinitions)
}

/**
 * Helper function to get all edge case blocks
 */
export const getAllEdgeCaseBlocks = (): Record<string, unknown>[] => {
  return Object.values(edgeCaseBlockDefinitions)
}

/**
 * Schema validator for block definitions
 * This can be used to validate block data during testing
 */
export const validateBlock = (data: unknown): Schema.Schema.Result.Type<unknown> => {
  const BlockSchema = Schema.Struct({
    id: Schema.String,
    type: Schema.Literal('AIR', 'DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND'),
    properties: Schema.Struct({
      hardness: Schema.Number.pipe(Schema.between(0, 100)),
      transparency: Schema.Boolean,
      solid: Schema.Boolean,
      emissive: Schema.Boolean,
      friction: Schema.Number.pipe(Schema.between(0, 1)),
    }),
    faces: Schema.Struct({
      top: Schema.Boolean,
      bottom: Schema.Boolean,
      north: Schema.Boolean,
      south: Schema.Boolean,
      east: Schema.Boolean,
      west: Schema.Boolean,
    }),
  })

  return Schema.parseUnknown(BlockSchema)(data)
}
