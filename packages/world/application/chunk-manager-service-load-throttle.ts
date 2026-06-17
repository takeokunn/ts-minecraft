const CHUNK_LOAD_THROTTLE_WINDOW_MILLIS = 200

export const resolveChunkLoadThrottle = (
  now: number,
  lastLoadTime: number,
): readonly [shouldLoad: boolean, nextLastLoadTime: number] =>
  now - lastLoadTime < CHUNK_LOAD_THROTTLE_WINDOW_MILLIS ? [false, lastLoadTime] : [true, now]
