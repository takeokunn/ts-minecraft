/**
 * Service Composition Layer - Centralized Effect-TS Service Management
 *
 * This layer provides a unified composition of all domain services with proper
 * dependency injection, error handling, and resource management using Effect-TS.
 */

import { Layer, Effect, Context } from 'effect'

// Import all domain services
import { EntityDomainService, EntityDomainServiceInterface } from '@domain/services/entity-domain.service'
import { WorldDomainService } from '@domain/services/world-domain.service'
import { PhysicsDomainService, PhysicsDomainServiceInterface } from '@domain/services/physics-domain.service'
import { ChunkLoadingService, ChunkLoadingServiceLive } from '@domain/services/chunk-loading.service'
import { AdvancedTargetingService, AdvancedTargetingServiceLive } from '@domain/services/targeting-advanced.service'
import { MeshGenerationService, meshGenerationServiceLive } from '@domain/services/mesh-generation.service'
import { WorldManagementDomainService, WorldManagementDomainServiceLive } from '@domain/services/world-management-domain.service'

// Import infrastructure adapters (these would be provided by infrastructure layer)
import type { TerrainGeneratorPort, ChunkRepositoryPort, MeshGeneratorPort } from '@domain/services/chunk-loading.service'
import type { WorldPort } from '@domain/services/targeting-advanced.service'

// ===== DOMAIN SERVICE REGISTRY =====

/**
 * Registry of all domain services for type-safe dependency injection
 */
export interface DomainServiceRegistry {
  readonly entityDomainService: EntityDomainServiceInterface
  readonly worldDomainService: typeof WorldDomainService.Service
  readonly physicsDomainService: PhysicsDomainServiceInterface
  readonly chunkLoadingService: ChunkLoadingService
  readonly advancedTargetingService: AdvancedTargetingService
  readonly meshGenerationService: MeshGenerationService
  readonly worldManagementService: typeof WorldManagementDomainService.Service
}

export const DomainServiceRegistry = Context.GenericTag<DomainServiceRegistry>('DomainServiceRegistry')

// ===== SERVICE LAYER COMPOSITION =====

/**
 * Core domain services layer
 * Composes all fundamental domain services without external dependencies
 */
export const CoreDomainServicesLayer = Layer.mergeAll(EntityDomainService.Live, WorldDomainService.Live, PhysicsDomainService.Live)

/**
 * Advanced domain services layer
 * Requires external ports to be provided by infrastructure layer
 */
export const AdvancedDomainServicesLayer = Layer.mergeAll(meshGenerationServiceLive, ChunkLoadingServiceLive, AdvancedTargetingServiceLive, WorldManagementDomainServiceLive)

/**
 * Complete domain services layer
 * Combines all domain services into a single layer
 */
export const DomainServicesLayer = Layer.mergeAll(CoreDomainServicesLayer, AdvancedDomainServicesLayer)

/**
 * Service registry layer that provides access to all services
 */
export const DomainServiceRegistryLive = Layer.effect(
  DomainServiceRegistry,
  Effect.gen(function* () {
    const entityDomainService = yield* EntityDomainService
    const worldDomainService = yield* WorldDomainService
    const physicsDomainService = yield* PhysicsDomainService
    const chunkLoadingService = yield* ChunkLoadingService
    const advancedTargetingService = yield* AdvancedTargetingService
    const meshGenerationService = yield* MeshGenerationService
    const worldManagementService = yield* WorldManagementDomainService

    return DomainServiceRegistry.of({
      entityDomainService,
      worldDomainService,
      physicsDomainService,
      chunkLoadingService,
      advancedTargetingService,
      meshGenerationService,
      worldManagementService,
    })
  }),
)

// ===== SERVICE DEPENDENCIES VALIDATION =====

/**
 * Service for validating all dependencies are properly wired
 */
export interface ServiceDependencyValidator {
  readonly validateAllDependencies: () => Effect.Effect<ServiceValidationResult, never, never>
  readonly validateService: <T>(serviceTag: Context.Tag<T, T>) => Effect.Effect<boolean, never, never>
}

export interface ServiceValidationResult {
  readonly isValid: boolean
  readonly missingServices: readonly string[]
  readonly serviceCount: number
  readonly warnings: readonly string[]
}

export const ServiceDependencyValidator = Context.GenericTag<ServiceDependencyValidator>('ServiceDependencyValidator')

export const ServiceDependencyValidatorLive = Layer.effect(
  ServiceDependencyValidator,
  Effect.gen(function* () {
    return ServiceDependencyValidator.of({
      validateAllDependencies: () =>
        Effect.gen(function* () {
          const missingServices: string[] = []
          const warnings: string[] = []
          let serviceCount = 0

          try {
            // Test core domain services
            yield* EntityDomainService
            serviceCount++
          } catch {
            missingServices.push('EntityDomainService')
          }

          try {
            yield* WorldDomainService
            serviceCount++
          } catch {
            missingServices.push('WorldDomainService')
          }

          try {
            yield* PhysicsDomainService
            serviceCount++
          } catch {
            missingServices.push('PhysicsDomainService')
          }

          try {
            yield* ChunkLoadingService
            serviceCount++
          } catch {
            missingServices.push('ChunkLoadingService')
          }

          try {
            yield* AdvancedTargetingService
            serviceCount++
          } catch {
            missingServices.push('AdvancedTargetingService')
          }

          try {
            yield* MeshGenerationService
            serviceCount++
          } catch {
            missingServices.push('MeshGenerationService')
          }

          try {
            yield* WorldManagementDomainService
            serviceCount++
          } catch {
            missingServices.push('WorldManagementDomainService')
          }

          // Check for port dependencies
          try {
            yield* TerrainGeneratorPort
          } catch {
            warnings.push('TerrainGeneratorPort not available - chunk loading may fail')
          }

          try {
            yield* ChunkRepositoryPort
          } catch {
            warnings.push('ChunkRepositoryPort not available - chunk persistence disabled')
          }

          try {
            yield* MeshGeneratorPort
          } catch {
            warnings.push('MeshGeneratorPort not available - mesh generation disabled')
          }

          try {
            yield* WorldPort
          } catch {
            warnings.push('WorldPort not available - targeting system may fail')
          }

          return {
            isValid: missingServices.length === 0,
            missingServices,
            serviceCount,
            warnings,
          }
        }),

      validateService: <T>(serviceTag: Context.Tag<T, T>) =>
        Effect.gen(function* () {
          try {
            yield* serviceTag
            return true
          } catch {
            return false
          }
        }),
    })
  }),
)

// ===== SERVICE LIFECYCLE MANAGEMENT =====

/**
 * Service lifecycle manager for proper startup and shutdown
 */
export interface ServiceLifecycleManager {
  readonly startupServices: () => Effect.Effect<void, never, never>
  readonly shutdownServices: () => Effect.Effect<void, never, never>
  readonly restartService: <T>(serviceTag: Context.Tag<T, T>) => Effect.Effect<boolean, never, never>
  readonly getServiceHealth: () => Effect.Effect<ServiceHealthReport, never, never>
}

export interface ServiceHealthReport {
  readonly healthy: readonly string[]
  readonly unhealthy: readonly string[]
  readonly degraded: readonly string[]
  readonly totalServices: number
  readonly uptime: number
}

export const ServiceLifecycleManager = Context.GenericTag<ServiceLifecycleManager>('ServiceLifecycleManager')

export const ServiceLifecycleManagerLive = Layer.effect(
  ServiceLifecycleManager,
  Effect.gen(function* () {
    const startTime = Date.now()

    return ServiceLifecycleManager.of({
      startupServices: () =>
        Effect.gen(function* () {
          // Validate all dependencies
          const validator = yield* ServiceDependencyValidator
          const validationResult = yield* validator.validateAllDependencies()

          if (!validationResult.isValid) {
            console.warn('Service startup warnings:', {
              missingServices: validationResult.missingServices,
              warnings: validationResult.warnings,
            })
          }

          console.info('Domain services startup complete', {
            serviceCount: validationResult.serviceCount,
            isValid: validationResult.isValid,
          })
        }),

      shutdownServices: () =>
        Effect.gen(function* () {
          // Gracefully shutdown services if needed
          // For now, just log shutdown
          console.info('Domain services shutdown initiated')

          // Could add specific shutdown logic for services that need it
          // For example, clearing caches, saving state, etc.
          try {
            const chunkService = yield* ChunkLoadingService
            yield* chunkService.clearCache()
          } catch {
            // Service may not be available
          }
        }),

      restartService: <T>(_serviceTag: Context.Tag<T, T>) =>
        Effect.gen(function* () {
          // For domain services, restart typically means clearing caches
          // In a full implementation, this would restart specific services
          return true
        }),

      getServiceHealth: () =>
        Effect.gen(function* () {
          const validator = yield* ServiceDependencyValidator
          const validationResult = yield* validator.validateAllDependencies()

          const healthy: string[] = []
          const unhealthy: string[] = []
          const degraded: string[] = []

          // Check each service health
          const servicesToCheck = [
            'EntityDomainService',
            'WorldDomainService',
            'PhysicsDomainService',
            'ChunkLoadingService',
            'AdvancedTargetingService',
            'MeshGenerationService',
            'WorldManagementDomainService',
          ]

          for (const serviceName of servicesToCheck) {
            if (validationResult.missingServices.includes(serviceName)) {
              unhealthy.push(serviceName)
            } else {
              healthy.push(serviceName)
            }
          }

          // Services with warnings are considered degraded
          validationResult.warnings.forEach((warning) => {
            const serviceName = warning.split(' ')[0]
            if (serviceName && !degraded.includes(serviceName)) {
              degraded.push(serviceName)
            }
          })

          return {
            healthy,
            unhealthy,
            degraded,
            totalServices: servicesToCheck.length,
            uptime: Date.now() - startTime,
          }
        }),
    })
  }),
)

// ===== COMPLETE SERVICE LAYER =====

/**
 * Complete domain layer with all services, validation, and lifecycle management
 */
export const CompleteDomainLayer = Layer.mergeAll(DomainServicesLayer, DomainServiceRegistryLive, ServiceDependencyValidatorLive, ServiceLifecycleManagerLive)

// ===== UTILITY FUNCTIONS =====

/**
 * Utilities for working with the service composition
 */
export const ServiceCompositionUtils = {
  /**
   * Create a minimal domain layer for testing
   */
  createTestDomainLayer: () => CoreDomainServicesLayer,

  /**
   * Create domain layer with mocked external dependencies
   */
  createMockedDomainLayer: () => {
    // Create mock implementations of external ports
    const mockTerrainGenerator = Layer.succeed(TerrainGeneratorPort, {
      generateTerrain: (_coords) => Effect.fail(new Error('Mock terrain generator')),
    } as any)

    const mockChunkRepository = Layer.succeed(ChunkRepositoryPort, {
      saveChunk: () => Effect.void,
      loadChunk: () => Effect.succeed(Option.none()),
      deleteChunk: () => Effect.void,
      chunkExists: () => Effect.succeed(false),
    } as any)

    const mockMeshGenerator = Layer.succeed(MeshGeneratorPort, {
      generateMesh: () => Effect.succeed({}),
    } as any)

    const mockWorldPort = Layer.succeed(WorldPort, {
      getVoxel: () => Effect.succeed(Option.none()),
      updateComponent: () => Effect.void,
    } as any)

    const mockPorts = Layer.mergeAll(mockTerrainGenerator, mockChunkRepository, mockMeshGenerator, mockWorldPort)

    return Layer.provide(DomainServicesLayer, mockPorts)
  },

  /**
   * Validate service layer configuration
   */
  validateServiceConfiguration: () =>
    Effect.gen(function* () {
      const validator = yield* ServiceDependencyValidator
      return yield* validator.validateAllDependencies()
    }),

  /**
   * Get service runtime metrics
   */
  getServiceMetrics: () =>
    Effect.gen(function* () {
      const lifecycleManager = yield* ServiceLifecycleManager
      const healthReport = yield* lifecycleManager.getServiceHealth()

      return {
        ...healthReport,
        healthPercentage: (healthReport.healthy.length / healthReport.totalServices) * 100,
        hasIssues: healthReport.unhealthy.length > 0 || healthReport.degraded.length > 0,
      }
    }),
} as const

// ===== TYPE EXPORTS =====

export type { DomainServiceRegistry, ServiceValidationResult, ServiceHealthReport, ServiceDependencyValidator, ServiceLifecycleManager }
