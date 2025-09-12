import path from 'path'
import { fileURLToPath } from 'url'
import { Effect, Layer, pipe } from 'effect'
import { FileSystem, FileSystemLive, ImageProcessor, ImageProcessorLive, Logger, LoggerLive } from './services'
import { TEXTURE_TILE_SIZE as TILE_SIZE, ATLAS_WIDTH_IN_TILES } from '../src/shared/constants/texture.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const texturesDir = path.join(__dirname, '../public/texture')
const outputAtlasPath = path.join(texturesDir, 'texture.png')

interface TextureInfo {
  path: string
  name: string // e.g., 'grass_top'
}

const findAllTextureFiles = (): Effect.Effect<TextureInfo[], Error, FileSystem | Logger> =>
  Effect.gen(function* (_) {
    const fs = yield* _(FileSystem)
    const logger = yield* _(Logger)

    const blockDirs = yield* _(fs.readdir(texturesDir, { withFileTypes: true }))

    const textureInfosEffects = blockDirs.map((blockDir) =>
      Effect.gen(function* (_) {
        if (blockDir.isDirectory()) {
          const blockName = blockDir.name
          const faceFilesPath = path.join(texturesDir, blockName)
          const faceFiles = yield* _(
            fs.readdirSimple(faceFilesPath).pipe(
              Effect.catchAll((_error) =>
                pipe(
                  logger.warn(`Could not read directory ${faceFilesPath}, skipping.`),
                  Effect.flatMap(() => Effect.succeed([] as string[])),
                ),
              ),
            ),
          )

          return faceFiles
            .filter((faceFile) => faceFile.endsWith('.jpg') || faceFile.endsWith('.png'))
            .map((faceFile) => {
              const faceName = path.basename(faceFile, path.extname(faceFile))
              return {
                path: path.join(faceFilesPath, faceFile),
                name: `${blockName}_${faceName}`,
              }
            })
        }
        return []
      }),
    )

    const textureInfosArrays = yield* _(Effect.all(textureInfosEffects))
    const textureInfos = textureInfosArrays.flat().sort((a, b) => a.name.localeCompare(b.name))
    return textureInfos
  })

const generateTextureAtlas = (): Effect.Effect<void, unknown, FileSystem | ImageProcessor | Logger> =>
  Effect.gen(function* (_) {
    const logger = yield* _(Logger)
    const imageProcessor = yield* _(ImageProcessor)
    yield* _(logger.log('Starting texture atlas generation...'))

    const textureFiles = yield* _(findAllTextureFiles())

    if (textureFiles.length === 0) {
      return yield* _(logger.warn('No texture files found to generate the atlas.'))
    }

    const atlasWidth = ATLAS_WIDTH_IN_TILES * TILE_SIZE
    const atlasHeight = Math.ceil(textureFiles.length / ATLAS_WIDTH_IN_TILES) * TILE_SIZE

    const atlas = yield* _(
      imageProcessor.createImage({
        width: atlasWidth,
        height: atlasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }),
    )

    const composites = yield* _(
      Effect.all(
        textureFiles.map(({ path }, index) =>
          Effect.gen(function* (_) {
            const x = (index % ATLAS_WIDTH_IN_TILES) * TILE_SIZE
            const y = Math.floor(index / ATLAS_WIDTH_IN_TILES) * TILE_SIZE
            const resizedImageBuffer = yield* _(imageProcessor.resizeImage(path, TILE_SIZE, TILE_SIZE))
            return {
              input: resizedImageBuffer,
              left: x,
              top: y,
            }
          }),
        ),
      ),
    )

    yield* _(imageProcessor.compositeImages(atlas, composites))
    yield* _(imageProcessor.toFile(atlas, outputAtlasPath))

    yield* _(logger.log(`Texture atlas successfully generated at: ${outputAtlasPath}`))
    yield* _(logger.log('--- Texture Coordinates ---'))
    yield* _(logger.log('Please update your blockDefinitions with these coordinates:'))
    yield* _(
      Effect.forEach(textureFiles, ({ name }, index) => {
        const x = index % ATLAS_WIDTH_IN_TILES
        const y = Math.floor(index / ATLAS_WIDTH_IN_TILES)
        return logger.log(`'${name}': [${x}, ${y}]`)
      }),
    )
    yield* _(logger.log('---------------------------'))
  })

const main = generateTextureAtlas()

const runnable = Effect.provide(main, Layer.mergeAll(FileSystemLive, ImageProcessorLive, LoggerLive))

// --- Main Execution ---
// Vitest sets this environment variable
/* v8 ignore start */
if (!process.env.VITEST) {
  Effect.runPromise(runnable).catch((error) => {
    console.error('Failed to generate texture atlas:', error)
    process.exit(1)
  })
}
/* v8 ignore stop */

export { findAllTextureFiles, generateTextureAtlas, TILE_SIZE, ATLAS_WIDTH_IN_TILES }
