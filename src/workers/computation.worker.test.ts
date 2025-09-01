import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fc } from '@fast-check/vitest';
import {
  generateChunk,
  generateGreedyMesh,
  messageHandler,
  isOpaque,
} from './computation.worker';
import type { BlockData, GenerationParams, PlacedBlock } from '@/domain/types';
import { blockTypeNames, BlockType } from '@/domain/block';

// Mock the perlin-noise module to make tests deterministic
vi.mock('perlin-noise', () => ({
  seed: vi.fn(),
  perlin2: vi.fn((x, y) => (x + y) * 0.1), // Simple deterministic noise
}));

// --- Arbitraries for Property-Based Testing ---

const blockTypeArbitrary = fc.constantFrom(...blockTypeNames);

const positionArbitrary = fc.record({
  x: fc.integer({ min: -100, max: 100 }),
  y: fc.integer({ min: -25, max: 25 }),
  z: fc.integer({ min: -100, max: 100 }),
});

const placedBlockArbitrary: fc.Arbitrary<PlacedBlock> = fc.record({
  x: fc.integer({ min: -100, max: 100 }),
  y: fc.integer({ min: -25, max: 25 }),
  z: fc.integer({ min: -100, max: 100 }),
  blockType: blockTypeArbitrary,
});

const generationParamsArbitrary: fc.Arbitrary<GenerationParams> = fc.record({
  chunkX: fc.integer({ min: -10, max: 10 }),
  chunkZ: fc.integer({ min: -10, max: 10 }),
  seeds: fc.record({
    world: fc.integer(),
    biome: fc.integer(),
    trees: fc.integer(),
  }),
  amplitude: fc.float({ min: 1, max: 20 }),
  editedBlocks: fc.record({
    placed: fc.array(placedBlockArbitrary),
    destroyed: fc.array(positionArbitrary),
  }),
});

describe('workers/computation.worker', () => {
  describe('isOpaque', () => {
    it('should return false for transparent blocks like water and glass', () => {
      expect(isOpaque('water')).toBe(false);
      expect(isOpaque('glass')).toBe(false);
    });

    it('should return true for all other block types', () => {
      const opaqueBlocks = blockTypeNames.filter(
        (b) => b !== 'water' && b !== 'glass',
      );
      for (const blockType of opaqueBlocks) {
        expect(isOpaque(blockType)).toBe(true);
      }
    });

    it('should return false for undefined input', () => {
      expect(isOpaque(undefined)).toBe(false);
    });
  });

  describe('generateGreedyMesh', () => {
    it('should generate a correct mesh for a single block', () => {
      const blocks: BlockData[] = [{ x: 0, y: 0, z: 0, blockType: 'stone' }];
      const mesh = generateGreedyMesh(blocks, 0, 0);

      // 6 faces * 4 vertices/face * 3 components/vertex = 72
      expect(mesh.positions.length).toBe(72);
      // 6 faces * 4 vertices/face * 3 components/normal = 72
      expect(mesh.normals.length).toBe(72);
      // 6 faces * 4 vertices/face * 2 components/uv = 48
      expect(mesh.uvs.length).toBe(48);
      // 6 faces * 2 triangles/face * 3 indices/triangle = 36
      expect(mesh.indices.length).toBe(36);
    });

    it('should not generate faces between two adjacent opaque blocks', () => {
      const blocks: BlockData[] = [
        { x: 0, y: 0, z: 0, blockType: 'stone' },
        { x: 1, y: 0, z: 0, blockType: 'dirt' },
      ];
      const mesh = generateGreedyMesh(blocks, 0, 0);

      // 2 blocks * 6 faces = 12 total faces. 2 are internal. 10 remain.
      // 10 faces * 4 * 3 = 120 positions
      expect(mesh.positions.length).toBe(120);
      // 10 faces * 2 * 3 = 60 indices
      expect(mesh.indices.length).toBe(60);
    });

    it('should generate faces between an opaque and a transparent block', () => {
      const blocks: BlockData[] = [
        { x: 0, y: 0, z: 0, blockType: 'stone' },
        { x: 1, y: 0, z: 0, blockType: 'glass' },
      ];
      const mesh = generateGreedyMesh(blocks, 0, 0);

      // The face between stone and glass should be rendered for both.
      // Stone: 6 faces. Glass: 6 faces. Total 12 faces.
      // 12 faces * 4 * 3 = 144 positions
      expect(mesh.positions.length).toBe(144);
      // 12 faces * 2 * 3 = 72 indices
      expect(mesh.indices.length).toBe(72);
    });

    it('should generate no mesh for a fully enclosed block', () => {
      const blocks: BlockData[] = [
        { x: 1, y: 1, z: 1, blockType: 'stone' }, // Enclosed block
        { x: 0, y: 1, z: 1, blockType: 'dirt' },
        { x: 2, y: 1, z: 1, blockType: 'dirt' },
        { x: 1, y: 0, z: 1, blockType: 'dirt' },
        { x: 1, y: 2, z: 1, blockType: 'dirt' },
        { x: 1, y: 1, z: 0, blockType: 'dirt' },
        { x: 1, y: 1, z: 2, blockType: 'dirt' },
      ];
      const mesh = generateGreedyMesh(blocks, 0, 0);

      // The mesh should only contain the 24 outer faces of the dirt blocks.
      // 24 faces * 4 * 3 = 288 positions
      expect(mesh.positions.length).toBe(288);
      // 24 faces * 2 * 3 = 144 indices
      expect(mesh.indices.length).toBe(144);
    });

    it('PBT: should always generate valid mesh data', () => {
      const blockDataArrayArbitrary = fc.array(
        fc.record({
          x: fc.integer({ min: 0, max: 9 }),
          y: fc.integer({ min: 0, max: 9 }),
          z: fc.integer({ min: 0, max: 9 }),
          blockType: blockTypeArbitrary,
        }),
      );

      fc.assert(
        fc.property(blockDataArrayArbitrary, (blocks) => {
          const mesh = generateGreedyMesh(blocks, 0, 0);

          // Number of values must be a multiple of the components
          expect(mesh.positions.length % 3).toBe(0);
          expect(mesh.normals.length % 3).toBe(0);
          expect(mesh.uvs.length % 2).toBe(0);
          expect(mesh.indices.length % 3).toBe(0);

          // Vertices are defined in quads (4 vertices)
          const vertexCount = mesh.positions.length / 3;
          expect(vertexCount % 4).toBe(0);

          // Indices form triangles from the quads
          const quadCount = vertexCount / 4;
          expect(mesh.indices.length).toBe(quadCount * 6);
        }),
      );
    });
  });

  describe('generateChunk', () => {
    it('should produce deterministic output for the same parameters', () => {
      const params: GenerationParams = {
        chunkX: 1,
        chunkZ: 1,
        seeds: { world: 123, biome: 456, trees: 789 },
        amplitude: 15,
        editedBlocks: { placed: [], destroyed: [] },
      };
      const result1 = generateChunk(params);
      const result2 = generateChunk(params);

      expect(result1.chunkX).toBe(result2.chunkX);
      expect(result1.chunkZ).toBe(result2.chunkZ);
      expect(result1.blocks).toEqual(result2.blocks);
      expect(result1.mesh).toEqual(result2.mesh);
    });

    it('should match snapshot for a fixed set of parameters', () => {
      const params: GenerationParams = {
        chunkX: 0,
        chunkZ: 0,
        seeds: { world: 1, biome: 1, trees: 1 },
        amplitude: 10,
        editedBlocks: {
          placed: [{ x: 0, y: 10, z: 0, blockType: 'brick' }],
          destroyed: [{ x: 1, y: 5, z: 1 }],
        },
      };
      const result = generateChunk(params);

      // Convert typed arrays to regular arrays for stable snapshotting
      const snapshotFriendlyResult = {
        ...result,
        mesh: {
          positions: Array.from(result.mesh.positions),
          normals: Array.from(result.mesh.normals),
          uvs: Array.from(result.mesh.uvs),
          indices: Array.from(result.mesh.indices),
        },
      };
      expect(snapshotFriendlyResult).toMatchSnapshot();
    });
  });

  describe('messageHandler', () => {
    const mockPostMessage = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      // Mock the global 'self' object available in web workers
      vi.stubGlobal('self', {
        postMessage: mockPostMessage,
      });
    });

    it('PBT: should call generateChunk and post the result with transferables', () => {
      fc.assert(
        fc.property(generationParamsArbitrary, (params) => {
          mockPostMessage.mockClear();
          const event = {
            data: { type: 'generateChunk', payload: params },
          } as MessageEvent;

          messageHandler(event);

          expect(mockPostMessage).toHaveBeenCalledOnce();
          const [result, transferConfig] = mockPostMessage.mock.calls[0]!;

          expect(result.chunkX).toBe(params.chunkX);
          expect(result.chunkZ).toBe(params.chunkZ);
          expect(transferConfig.transfer).toEqual([
            result.mesh.positions.buffer,
            result.mesh.normals.buffer,
            result.mesh.uvs.buffer,
            result.mesh.indices.buffer,
          ]);
        }),
      );
    });

    it('should do nothing for an unknown message type', () => {
      const event = {
        data: { type: 'unknown', payload: {} },
      } as MessageEvent;

      messageHandler(event);
      expect(mockPostMessage).not.toHaveBeenCalled();
    });
  });
});