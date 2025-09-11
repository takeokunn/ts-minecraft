/**
 * Performance and optimization constants
 */

// Frame Rate and Timing
export const TARGET_FPS = 60
export const MAX_DELTA_TIME = 1000 / 30 // Cap at 30 FPS minimum
export const PERFORMANCE_SAMPLE_SIZE = 100

// Memory Management
export const MAX_CACHED_CHUNKS = 100
export const MEMORY_CLEANUP_THRESHOLD = 0.8 // 80% memory usage
export const GC_TRIGGER_INTERVAL = 30000 // 30 seconds

// Worker Thread Constants
export const MAX_WORKER_THREADS = navigator.hardwareConcurrency || 4
export const WORKER_TASK_TIMEOUT = 5000 // 5 seconds
export const WORKER_BATCH_SIZE = 10

// Rendering Performance
export const MAX_DRAW_CALLS = 1000
export const FRUSTUM_CULLING_MARGIN = 5
export const LOD_DISTANCE_THRESHOLD = 50

// Network Performance
export const MAX_CONCURRENT_REQUESTS = 5
export const REQUEST_TIMEOUT = 10000 // 10 seconds
export const RETRY_ATTEMPTS = 3

// Cache Settings
export const TEXTURE_CACHE_SIZE = 50 * 1024 * 1024 // 50MB
export const MESH_CACHE_SIZE = 100 * 1024 * 1024 // 100MB
export const SHADER_CACHE_SIZE = 10 * 1024 * 1024 // 10MB
