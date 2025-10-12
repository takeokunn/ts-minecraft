/**
 * @fileoverview Camera Domain Layer
 * Domain層の依存関係を提供（Repository層 + Domain Service層）
 */

import { Layer } from 'effect'
import {
  CameraConfigurationServiceLive,
  CameraTransformServiceLive,
  PerspectiveCalculatorServiceLive,
  ViewFrustumServiceLive,
} from './domain_service'
import { CameraCommandHandlerLive, CameraQueryHandlerLive, CameraReadModelLive } from './cqrs'
import {
  CameraConfigurationRepositoryLive,
  CameraPresetRepositoryLive,
  CameraStateRepositoryLive,
  PlayerCameraRepositoryLive,
  SceneCameraRepositoryLive,
} from './repository'

/**
 * Camera Domain Layer
 * - Domain Service: 4 services
 * - Repository: 5 repositories
 * - CQRS Handler: Command / Query
 */
export const CameraDomainLive = Layer.mergeAll(
  // Domain Services
  CameraConfigurationServiceLive,
  CameraTransformServiceLive,
  PerspectiveCalculatorServiceLive,
  ViewFrustumServiceLive,
  // Repositories
  CameraConfigurationRepositoryLive,
  CameraPresetRepositoryLive,
  CameraStateRepositoryLive,
  PlayerCameraRepositoryLive,
  SceneCameraRepositoryLive,
  // Read Model
  CameraReadModelLive,
  // CQRS Handlers
  CameraCommandHandlerLive,
  CameraQueryHandlerLive
)
