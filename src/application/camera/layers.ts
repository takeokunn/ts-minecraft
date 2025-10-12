/**
 * @fileoverview Camera Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { CameraDomainLive } from '@/domain/camera/layers'
import { Layer } from 'effect'
import { CameraApplicationServicesLayer } from './layer'

/**
 * Camera Application Layer
 * - Application Service: CameraApplicationServicesLayer (4 services)
 * - 依存: CameraDomainLive (Repository層 + Domain Service層)
 */
export const CameraApplicationLive = CameraApplicationServicesLayer.pipe(Layer.provide(CameraDomainLive))
