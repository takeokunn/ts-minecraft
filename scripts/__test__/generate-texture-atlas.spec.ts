import { describe, test, assert, vi } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import * as script from '../generate-texture-atlas'
import { FileSystem, ImageProcessor, Logger, SharpInstance } from '../services'
import { Dirent } from 'fs'

// Helper to create a mock Dirent
const createMockDirent = (name: string, isDirectory: boolean): Dirent =>
  ({
    name,
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  } as Dirent)

const साइलेंटLogger = Layer.succeed(Logger, {
  log: () => Effect.unit,
  warn: () => Effect.unit,
  error: () => Effect.unit,
})

describe('scripts/generate-texture-atlas', () => {
  describe('findAllTextureFiles', () => {
    test('should find all texture files in the directory structure', () =>
      Effect.gen(function* (_) {
        const testLayer = Layer.succeed(
          FileSystem,
          FileSystem.of({
            readdir: (dirPath: string) => {
              if (dirPath.endsWith('public/texture')) {
                return Effect.succeed([
                  createMockDirent('grass', true),
                  createMockDirent('dirt', true),
                  createMockDirent('stone', false), // This is a file, should be ignored
                  createMockDirent('non-existent', true),
                ])
              }
              if (dirPath.endsWith('non-existent')) {
                return Effect.fail(new Error('ENOENT'))
              }
              return Effect.succeed([])
            },
            readdirSimple: (dirPath: string) => {
              if (dirPath.endsWith('grass')) {
                return Effect.succeed(['top.png', 'side.png', 'bottom.jpg', 'invalid.txt'])
              }
              if (dirPath.endsWith('dirt')) {
                return Effect.succeed(['side.png'])
              }
              return Effect.succeed([])
            },
          }),
        ).pipe(Layer.provide(साइलेंटLogger))

        const result = yield* _(Effect.provide(script.findAllTextureFiles(), testLayer))

        assert.lengthOf(result, 4)
        assert.deepStrictEqual(
          result.map((f) => f.name).sort(),
          ['dirt_side', 'grass_bottom', 'grass_side', 'grass_top'],
        )
        assert.include(result[0].path, 'dirt/side.png')
      }))

    test('should handle empty directories', () =>
      Effect.gen(function* (_) {
        const testLayer = Layer.succeed(
          FileSystem,
          FileSystem.of({
            readdir: () => Effect.succeed([]),
            readdirSimple: () => Effect.succeed([]),
          }),
        ).pipe(Layer.provide(साइलेंटLogger))

        const result = yield* _(Effect.provide(script.findAllTextureFiles(), testLayer))
        assert.isEmpty(result)
      }))
  })

  describe('generateTextureAtlas', () => {
    test('should generate an atlas from found textures', () =>
      Effect.gen(function* (_) {
        const compositeSpy = vi.fn()
        const toFileSpy = vi.fn(() => Effect.succeed({} as any))

        const mockSharpInstance = {
          composite: compositeSpy,
        } as unknown as SharpInstance

        const TestFileSystem = Layer.succeed(
          FileSystem,
          FileSystem.of({
            readdir: (dirPath) => {
              if (dirPath.endsWith('public/texture')) {
                return Effect.succeed([createMockDirent('dirt', true), createMockDirent('grass', true)])
              }
              return Effect.succeed([])
            },
            readdirSimple: (dirPath) => {
              if (dirPath.endsWith('grass')) {
                return Effect.succeed(['top.png'])
              }
              if (dirPath.endsWith('dirt')) {
                return Effect.succeed(['side.png'])
              }
              return Effect.succeed([])
            },
          }),
        )

        const TestImageProcessor = Layer.succeed(
          ImageProcessor,
          ImageProcessor.of({
            createImage: () => Effect.succeed(mockSharpInstance),
            resizeImage: () => Effect.succeed(Buffer.from('')),
            compositeImages: (img, composites) =>
              Effect.sync(() => {
                compositeSpy(composites)
                return img
              }),
            toFile: (img, path) => toFileSpy(path),
          }),
        )

        const logSpy = vi.fn()
        const TestLogger = Layer.succeed(Logger, {
          log: (msg) => Effect.sync(() => logSpy(msg)),
          warn: () => Effect.unit,
          error: () => Effect.unit,
        })

        const testLayer = Layer.mergeAll(TestFileSystem, TestImageProcessor, TestLogger)

        yield* _(Effect.provide(script.generateTextureAtlas(), testLayer))

        assert.isTrue(compositeSpy.mock.calls[0][0].length === 2)
        // The order depends on localeCompare, dirt_side comes before grass_top
        assert.deepStrictEqual(compositeSpy.mock.calls[0][0][0], { input: Buffer.from(''), left: 0, top: 0 })
        assert.deepStrictEqual(compositeSpy.mock.calls[0][0][1], { input: Buffer.from(''), left: 16, top: 0 })
        assert.isTrue(toFileSpy.mock.calls[0][0].endsWith('texture.png'))
      }))

    test('should warn and return if no texture files are found', () =>
      Effect.gen(function* (_) {
        const warnSpy = vi.fn()
        const TestFileSystem = Layer.succeed(FileSystem, {
          readdir: () => Effect.succeed([]),
          readdirSimple: () => Effect.succeed([]),
        })
        const TestLogger = Layer.succeed(Logger, {
          warn: (msg) => Effect.sync(() => warnSpy(msg)),
          log: () => Effect.unit,
          error: () => Effect.unit,
        })
        const createImageSpy = vi.fn()
        const TestImageProcessor = Layer.succeed(ImageProcessor, {
          createImage: () => Effect.sync(() => createImageSpy()),
        } as any)

        const testLayer = Layer.mergeAll(TestFileSystem, TestLogger, TestImageProcessor)

        yield* _(Effect.provide(script.generateTextureAtlas(), testLayer))

        assert.strictEqual(warnSpy.mock.calls[0][0], 'No texture files found to generate the atlas.')
        assert.strictEqual(createImageSpy.mock.calls.length, 0)
      }))
  })
})