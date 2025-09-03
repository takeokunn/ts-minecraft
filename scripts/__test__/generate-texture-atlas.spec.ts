import { describe, it, assert } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import * as script from '../generate-texture-atlas'
import { FileSystem, Logger } from '../services'
import { Dirent } from 'fs'

const createMockDirent = (name: string, isDirectory: boolean): Dirent =>
  ({
    name,
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
  }) as Dirent

const साइलेंटLogger = Layer.succeed(Logger, {
  log: () => Effect.void,
  warn: () => Effect.void,
  error: () => Effect.void,
})

describe('scripts/generate-texture-atlas', () => {
  describe('findAllTextureFiles', () => {
    const fileSystemLayer = Layer.succeed(
      FileSystem,
      FileSystem.of({
        readdir: (dirPath: string) => {
          if (dirPath.endsWith('public/texture')) {
            return Effect.succeed([
              createMockDirent('grass', true),
              createMockDirent('stone.png', false),
            ])
          }
          if (dirPath.endsWith('grass')) {
            return Effect.succeed([createMockDirent('side.png', false)])
          }
          return Effect.succeed([])
        },
      }),
    )
    const testLayer = Layer.merge(fileSystemLayer, साइलेंटLogger)

    it.effect('should find all texture files', () =>
      Effect.gen(function* (_) {
        const result = yield* _(script.findAllTextureFiles())
        assert.deepStrictEqual(result.map((f) => f.name).sort(), ['grass_side', 'stone'])
      }).pipe(Effect.provide(testLayer)))
  })
})
