import { terrainBlocks } from './blocks.config.terrain'
import { oreAndMineralBlocks } from './blocks.config.ores'
import { craftedAndItemBlocks } from './blocks.config.crafted'
import { endBlocks } from './blocks.config.end'

export const initialBlocks = [...terrainBlocks, ...oreAndMineralBlocks, ...craftedAndItemBlocks, ...endBlocks]
export { defaultBlockProperties, defaultBlockFaces } from './blocks.config.terrain'
