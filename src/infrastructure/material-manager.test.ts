import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { fc } from '@fast-check/vitest';
import { createMaterialManager } from './material-manager';
import { TextureLoader, MeshBasicMaterial, Material, Texture } from 'three';
import { match } from 'ts-pattern';

vi.mock('three', async importOriginal => {
  const actualThree = await importOriginal<typeof import('three')>();
  return {
    ...actualThree,
    TextureLoader: vi.fn(),
    MeshBasicMaterial: vi.fn(),
    Texture: vi.fn(() => ({
      dispose: vi.fn(),
    })),
  };
});

const mockLoadAsync = vi.fn();
let mockTexture: Texture & { dispose: Mock };
let mockMaterial: Material & { dispose: Mock; map: any };

vi.mocked(TextureLoader).mockImplementation(() => ({
  loadAsync: mockLoadAsync,
}) as any);

vi.mocked(MeshBasicMaterial).mockImplementation(() => mockMaterial as any);

const texturePathArbitrary = fc.webUrl().map(url => url.replace(/^https?:\/\/[^/]+\//, ''));

describe('infrastructure/material-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTexture = { colorSpace: '', dispose: vi.fn() } as unknown as Texture & { dispose: Mock };
    mockMaterial = {
      map: mockTexture,
      dispose: vi.fn(),
    } as unknown as Material & { dispose: Mock; map: any };
    mockLoadAsync.mockResolvedValue(mockTexture);
  });

  describe('get()', () => {
    it('should load, create, and cache a material on the first call, and return cache on the second (PBT)', async () => {
      await fc.assert(
        fc.asyncProperty(texturePathArbitrary, async path => {
          vi.clearAllMocks();
          mockLoadAsync.mockResolvedValue(mockTexture);
          const manager = createMaterialManager();

          const material1 = await manager.get(path);
          const material2 = await manager.get(path);

          expect(material1).toBe(mockMaterial);
          expect(material2).toBe(material1);
          expect(mockLoadAsync).toHaveBeenCalledTimes(1);
          expect(mockLoadAsync).toHaveBeenCalledWith(path);
          expect(MeshBasicMaterial).toHaveBeenCalledTimes(1);
          expect(MeshBasicMaterial).toHaveBeenCalledWith({ map: mockTexture });
          expect(mockTexture.colorSpace).toBe('srgb');
        }),
      );
    });

    it('should handle concurrent requests for the same texture path by loading only once', async () => {
      await fc.assert(
        fc.asyncProperty(texturePathArbitrary, async path => {
          vi.clearAllMocks();
          mockLoadAsync.mockResolvedValue(mockTexture);
          const manager = createMaterialManager();

          const [material1, material2] = await Promise.all([manager.get(path), manager.get(path)]);

          expect(material1).toBe(mockMaterial);
          expect(material2).toBe(material1);
          expect(mockLoadAsync).toHaveBeenCalledTimes(1);
        }),
      );
    });

    it('should create different materials for different paths (PBT)', async () => {
      await fc.assert(
        fc.asyncProperty(texturePathArbitrary, texturePathArbitrary, async (path1, path2) => {
          fc.pre(path1 !== path2);

          vi.clearAllMocks();
          const mockTexture1 = { colorSpace: '', dispose: vi.fn() } as any;
          const mockMaterial1 = { map: mockTexture1, dispose: vi.fn() } as any;
          const mockTexture2 = { colorSpace: '', dispose: vi.fn() } as any;
          const mockMaterial2 = { map: mockTexture2, dispose: vi.fn() } as any;

          mockLoadAsync.mockResolvedValueOnce(mockTexture1).mockResolvedValueOnce(mockTexture2);
          vi.mocked(MeshBasicMaterial).mockReturnValueOnce(mockMaterial1).mockReturnValueOnce(mockMaterial2);

          const manager = createMaterialManager();
          const material1 = await manager.get(path1);
          const material2 = await manager.get(path2);

          expect(material1).not.toBe(material2);
          expect(material1).toBe(mockMaterial1);
          expect(material2).toBe(mockMaterial2);
          expect(mockLoadAsync).toHaveBeenCalledTimes(2);
        }),
      );
    });

    it('should throw a custom error if texture loading fails (PBT)', async () => {
      await fc.assert(
        fc.asyncProperty(texturePathArbitrary, fc.string(), async (path, errorMessage) => {
          vi.clearAllMocks();
          const loadError = new Error(errorMessage);
          mockLoadAsync.mockRejectedValue(loadError);

          const manager = createMaterialManager();
          const promise = manager.get(path);

          await expect(promise).rejects.toThrow(`Failed to load texture: ${path}, Error: ${errorMessage}`);
          await expect(promise).rejects.toHaveProperty('name', 'TextureLoadError');
        }),
      );
    });
  });

  describe('dispose()', () => {
    it('should dispose all cached materials and their textures', async () => {
      const manager = createMaterialManager();
      const path1 = 'path/to/texture1.png';
      const path2 = 'path/to/texture2.png';

      const mockTexture1 = { colorSpace: '', dispose: vi.fn() } as any;
      const mockMaterial1 = { map: mockTexture1, dispose: vi.fn() } as any;
      const mockTexture2 = { colorSpace: '', dispose: vi.fn() } as any;
      const mockMaterial2 = { map: mockTexture2, dispose: vi.fn() } as any;

      mockLoadAsync.mockResolvedValueOnce(mockTexture1).mockResolvedValueOnce(mockTexture2);
      vi.mocked(MeshBasicMaterial).mockReturnValueOnce(mockMaterial1).mockReturnValueOnce(mockMaterial2);

      await manager.get(path1);
      await manager.get(path2);

      manager.dispose();

      const result = match({
        material1Disposed: mockMaterial1.dispose.mock.calls.length,
        texture1Disposed: mockTexture1.dispose.mock.calls.length,
        material2Disposed: mockMaterial2.dispose.mock.calls.length,
        texture2Disposed: mockTexture2.dispose.mock.calls.length,
      })
        .with(
          {
            material1Disposed: 1,
            texture1Disposed: 1,
            material2Disposed: 1,
            texture2Disposed: 1,
          },
          () => 'all disposed',
        )
        .otherwise(() => 'not all disposed');

      expect(result).toBe('all disposed');
    });
  });
});
