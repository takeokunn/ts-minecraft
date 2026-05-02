/** Height above sea level at which alpine block rules apply */
export const ALPINE_HEIGHT_OFFSET = 28
/** Height above sea level for rugged outcrop detection */
export const OUTCROP_HEIGHT_OFFSET = 14

/** Ruggedness threshold for savanna gravel surface */
export const RUGGEDNESS_SAVANNA_GRAVEL = 0.42
/** Ruggedness threshold for mountains gravel surface */
export const RUGGEDNESS_MOUNTAINS_GRAVEL = 0.52
/** Ruggedness threshold for snow alpine stone surface (combined with alpine height) */
export const RUGGEDNESS_SNOW_ALPINE_STONE = 0.48
/** Ruggedness threshold for generic alpine stone surface */
export const RUGGEDNESS_ALPINE_STONE = 0.52
/** Ruggedness threshold for rugged rock outcrop (combined with outcrop height) */
export const RUGGEDNESS_OUTCROP = 0.56
