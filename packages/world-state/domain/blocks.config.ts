import { terrainBlocks } from './blocks.config.terrain'
import { oreAndMineralBlocks } from './blocks.config.ores'
import { craftedAndItemBlocks } from './blocks.config.crafted'

export const initialBlocks = [...terrainBlocks, ...oreAndMineralBlocks, ...craftedAndItemBlocks]
export { defaultBlockProperties, defaultBlockFaces } from './blocks.config.terrain'
