/**
 * Infrastructure and technical configuration using Effect-TS patterns
 * 
 * @deprecated Direct interface usage is deprecated. Use InfrastructureConfigService instead.
 * This file maintains backward compatibility while migrating to Effect-TS.
 */

import { Effect } from 'effect'
import {
  InfrastructureConfig,
  defaultInfrastructureConfig,
  InfrastructureConfigSchema,
  RenderingConfig,
  MemoryConfig,
  WorkerConfig,
  NetworkConfig,
  StorageConfig,
  MonitoringConfig,
  DevelopmentConfig,
  AssetConfig,
  AudioConfig,
  SecurityConfig,
} from './schemas/infrastructure.schema'
import {
  InfrastructureConfigService,
  InfrastructureConfigServiceLive,
  InfrastructureConfigError,
} from './services/infrastructure-config.service'
import {
  CapabilityDetectionService,
  CapabilityDetectionServiceLive,
  Capabilities,
} from './services/capability-detection.service'

// Re-export types for backward compatibility
export type { 
  InfrastructureConfig,
  RenderingConfig,
  MemoryConfig,
  WorkerConfig,
  NetworkConfig,
  StorageConfig,
  MonitoringConfig,
  DevelopmentConfig,
  AssetConfig,
  AudioConfig,
  SecurityConfig,
  Capabilities
}

// Re-export schema for validation
export { InfrastructureConfigSchema, InfrastructureConfigError }

// Re-export services
export { InfrastructureConfigService, InfrastructureConfigServiceLive }
export { CapabilityDetectionService, CapabilityDetectionServiceLive }

/**
 * @deprecated This interface is replaced by InfrastructureConfigSchema
 */
// Backward compatibility layer

/**
 * @deprecated Use InfrastructureConfigService.get() instead
 */
export const INFRASTRUCTURE_CONFIG = defaultInfrastructureConfig
