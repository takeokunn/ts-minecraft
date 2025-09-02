import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TILE_SIZE = 16 // Each texture is 16x16 pixels
const ATLAS_WIDTH_IN_TILES = 16

const texturesDir = path.join(__dirname, '../public/texture')
const outputAtlasPath = path.join(texturesDir, 'texture.png')

interface TextureInfo {
  path: string
  name: string // e.g., 'grass_top'
}

async function findAllTextureFiles(): Promise<TextureInfo[]> {
  const textureInfos: TextureInfo[] = []
  const blockDirs = await fs.readdir(texturesDir, { withFileTypes: true })

  for (const blockDir of blockDirs) {
    if (blockDir.isDirectory()) {
      const blockName = blockDir.name
      const faceFilesPath = path.join(texturesDir, blockName)
      try {
        const faceFiles = await fs.readdir(faceFilesPath)
        for (const faceFile of faceFiles) {
          if (faceFile.endsWith('.jpg') || faceFile.endsWith('.png')) {
            const faceName = path.basename(faceFile, path.extname(faceFile))
            textureInfos.push({
              path: path.join(faceFilesPath, faceFile),
              name: `${blockName}_${faceName}`,
            })
          }
        }
      } catch (error) {
        console.warn(`Could not read directory ${faceFilesPath}, skipping.`)
      }
    }
  }
  return textureInfos.sort((a, b) => a.name.localeCompare(b.name))
}

async function generateTextureAtlas() {
  console.log('Starting texture atlas generation...')

  const textureFiles = await findAllTextureFiles()

  if (textureFiles.length === 0) {
    console.warn('No texture files found to generate the atlas.')
    return
  }

  const atlasWidth = ATLAS_WIDTH_IN_TILES * TILE_SIZE
  const atlasHeight = Math.ceil(textureFiles.length / ATLAS_WIDTH_IN_TILES) * TILE_SIZE

  const atlas = sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })

  const composites = await Promise.all(
    textureFiles.map(async ({ path }, index) => {
      const x = (index % ATLAS_WIDTH_IN_TILES) * TILE_SIZE
      const y = Math.floor(index / ATLAS_WIDTH_IN_TILES) * TILE_SIZE
      const resizedImageBuffer = await sharp(path).resize(TILE_SIZE, TILE_SIZE).toBuffer()
      return {
        input: resizedImageBuffer,
        left: x,
        top: y,
      }
    }),
  )

  atlas.composite(composites)

  await atlas.toFile(outputAtlasPath)

  console.log(`Texture atlas successfully generated at: ${outputAtlasPath}`)
  console.log('--- Texture Coordinates ---')
  console.log('Please update your blockDefinitions with these coordinates:')
  textureFiles.forEach(({ name }, index) => {
    const x = index % ATLAS_WIDTH_IN_TILES
    const y = Math.floor(index / ATLAS_WIDTH_IN_TILES)
    console.log(`'${name}': [${x}, ${y}]`)
  })
  console.log('---------------------------')
}

// --- Main Execution ---
// Vitest sets this environment variable
/* v8 ignore start */
if (!process.env.VITEST) {
  generateTextureAtlas().catch((error) => {
    console.error('Failed to generate texture atlas:', error)
    process.exit(1)
  })
}
/* v8 ignore stop */

export { findAllTextureFiles, generateTextureAtlas, TILE_SIZE, ATLAS_WIDTH_IN_TILES }
