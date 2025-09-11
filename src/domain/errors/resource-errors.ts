import { defineError } from './generator'
import { ResourceError, InputError, NetworkError as BaseNetworkError } from './base-errors'

/**
 * Resource not found at specified path
 * Recovery: Use default resource or prompt for alternative
 */
export const ResourceNotFoundError = defineError<{
  readonly resourcePath: string
  readonly resourceType: 'texture' | 'model' | 'audio' | 'config' | 'data'
  readonly searchPaths?: string[]
}>('ResourceNotFoundError', ResourceError, 'fallback', 'medium')

/**
 * Resource loading failed
 * Recovery: Use cached version or fallback resource
 */
export const ResourceLoadError = defineError<{
  readonly resourcePath: string
  readonly reason: string
  readonly fileSize?: number
  readonly mimeType?: string
}>('ResourceLoadError', ResourceError, 'fallback', 'medium')

/**
 * Resource validation failed
 * Recovery: Use without validation or reject resource
 */
export const ValidationError = defineError<{
  readonly resourcePath: string
  readonly validationRules: string[]
  readonly failures: string[]
  readonly severity: 'warning' | 'error'
}>('ValidationError', ResourceError, 'fallback', 'medium')

/**
 * Resource cache operation failed
 * Recovery: Skip caching or clear cache
 */
export const ResourceCacheError = defineError<{
  readonly operation: 'store' | 'retrieve' | 'invalidate' | 'clear'
  readonly resourceKey: string
  readonly reason: string
  readonly cacheSize?: number
}>('ResourceCacheError', ResourceError, 'ignore', 'low')

/**
 * Resource format not supported
 * Recovery: Convert to supported format or use fallback
 */
export const UnsupportedFormatError = defineError<{
  readonly resourcePath: string
  readonly detectedFormat: string
  readonly supportedFormats: string[]
  readonly conversionAvailable: boolean
}>('UnsupportedFormatError', ResourceError, 'fallback', 'medium')

/**
 * Input device not available
 * Recovery: Use alternative input or disable input
 */
export const InputNotAvailableError = defineError<{
  readonly inputDevice: 'keyboard' | 'mouse' | 'gamepad' | 'touch'
  readonly reason: string
  readonly alternativeDevices?: string[]
}>('InputNotAvailableError', InputError, 'fallback', 'medium')

/**
 * Network operation failed
 * Recovery: Retry with exponential backoff or use offline mode
 */
export const NetworkError = defineError<{
  readonly operation: 'connect' | 'send' | 'receive' | 'disconnect'
  readonly endpoint: string
  readonly reason: string
  readonly retryCount?: number
  readonly statusCode?: number
}>('NetworkError', BaseNetworkError, 'retry', 'high')

/**
 * Asset bundle loading failed
 * Recovery: Load individual assets or use fallback bundle
 */
export const AssetBundleError = defineError<{
  readonly bundlePath: string
  readonly reason: string
  readonly partiallyLoaded: boolean
  readonly loadedAssets?: string[]
}>('AssetBundleError', ResourceError, 'fallback', 'high')

/**
 * Resource permission denied
 * Recovery: Request permission or use alternative resource
 */
export const ResourcePermissionError = defineError<{
  readonly resourcePath: string
  readonly requiredPermission: string
  readonly currentPermissions: string[]
  readonly canRequest: boolean
}>('ResourcePermissionError', ResourceError, 'user-prompt', 'high')
