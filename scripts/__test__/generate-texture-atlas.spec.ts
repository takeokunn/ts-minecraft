import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import sharp from 'sharp'
import fs from 'fs/promises'
import * as script from '../generate-texture-atlas'

// Mock the modules
vi.mock('sharp', () => {
  const composite = vi.fn().mockReturnThis()
  const toFile = vi.fn().mockResolvedValue({})
  const resize = vi.fn(() => ({ toBuffer: vi.fn().mockResolvedValue(Buffer.from('')) }))
  const sharpInstance = {
    composite,
    toFile,
    resize,
  }
  const sharpConstructor = vi.fn(() => sharpInstance)
  Object.assign(sharpConstructor, {
    cache: vi.fn(),
    concurrency: vi.fn(),
    counters: vi.fn(),
    simd: vi.fn(),
    libvipsVersion: '8.10.0',
  })
  return { default: sharpConstructor }
})

vi.mock('fs/promises', async () => {
  const actualFs = await vi.importActual<typeof fs>('fs/promises')
  return {
    ...actualFs,
    readdir: vi.fn(),
    writeFile: vi.fn(),
    default: {
      readdir: vi.fn(),
      writeFile: vi.fn(),
    },
  }
})

const mockedFs = vi.mocked(fs)
const mockedSharp = vi.mocked(sharp)

describe('scripts/generate-texture-atlas', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  describe('findAllTextureFiles', () => {
    it('should find all texture files in the directory structure', async () => {
      mockedFs.readdir.mockImplementation(async (dirPath: any) => {
        if (dirPath.endsWith('public/texture')) {
          return [
            { name: 'grass', isDirectory: () => true },
            { name: 'dirt', isDirectory: () => true },
            { name: 'stone', isDirectory: () => false }, // This is a file, should be ignored
            { name: 'non-existent', isDirectory: () => true },
          ]
        }
        if (dirPath.endsWith('grass')) {
          return ['top.png', 'side.png', 'bottom.jpg', 'invalid.txt']
        }
        if (dirPath.endsWith('dirt')) {
          return ['side.png']
        }
        if (dirPath.endsWith('non-existent')) {
          throw new Error('ENOENT')
        }
        return []
      })

      const textureFiles = await script.findAllTextureFiles()

      expect(textureFiles).toHaveLength(4)
      expect(textureFiles.map((f) => f.name).sort()).toEqual(['dirt_side', 'grass_bottom', 'grass_side', 'grass_top'])
      expect(textureFiles[0].path).toContain('dirt/side.png')
    })

    it('should handle empty directories', async () => {
      mockedFs.readdir.mockResolvedValue([])
      const textureFiles = await script.findAllTextureFiles()
      expect(textureFiles).toHaveLength(0)
    })
  })

  describe('generateTextureAtlas', () => {
    it('should generate an atlas from found textures', async () => {
      mockedFs.readdir.mockImplementation(async (p: any, options: any) => {
        const dirPath = p.toString();
        if (options?.withFileTypes) {
          if (dirPath.endsWith('public/texture')) {
            return [
              { name: 'dirt', isDirectory: () => true },
              { name: 'grass', isDirectory: () => true },
            ];
          }
        } else {
          if (dirPath.endsWith('grass')) {
            return ['top.png'];
          }
          if (dirPath.endsWith('dirt')) {
            return ['side.png'];
          }
        }
        return [];
      });

      await script.generateTextureAtlas();

      expect(mockedSharp).toHaveBeenCalledWith({
        create: {
          width: script.ATLAS_WIDTH_IN_TILES * script.TILE_SIZE,
          height: script.TILE_SIZE, // ceil(2 / 16) * 16
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      });

      const sharpInstance = mockedSharp.mock.results[0].value;
      expect(sharpInstance.composite).toHaveBeenCalledOnce();
      expect(sharpInstance.composite).toHaveBeenCalledWith(
        expect.arrayContaining([
          // The order depends on localeCompare, dirt_side comes before grass_top
          expect.objectContaining({ left: 0, top: 0 }), // dirt_side
          expect.objectContaining({ left: 16, top: 0 }), // grass_top
        ]),
      );
      expect(sharpInstance.toFile).toHaveBeenCalledOnce();
      expect(sharpInstance.toFile).toHaveBeenCalledWith(expect.stringContaining('texture.png'));
    });

    it('should warn and return if no texture files are found', async () => {
      mockedFs.readdir.mockResolvedValue([]);

      await script.generateTextureAtlas();

      expect(console.warn).toHaveBeenCalledWith('No texture files found to generate the atlas.');
      expect(mockedSharp).not.toHaveBeenCalled();
    });
  });
})