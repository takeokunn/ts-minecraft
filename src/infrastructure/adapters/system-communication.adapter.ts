/**
 * System Communication Adapter - Infrastructure Implementation
 *
 * This adapter implements the SystemCommunicationPort interface
 * and bridges the domain layer with the infrastructure implementation.
 * Following the DDD hexagonal architecture pattern.
 */

import { Layer } from 'effect'
import { SystemCommunicationPort } from '../../domain/ports/system-communication.port'
import { SystemCommunicationService, SystemCommunicationServiceLive } from '../communication/system-communication.service'

/**
 * System Communication Adapter
 * 
 * Maps the SystemCommunicationService to the SystemCommunicationPort
 */
export const SystemCommunicationAdapter = Layer.effect(
  SystemCommunicationPort,
  SystemCommunicationService,
)

/**
 * System Communication Live Layer
 * 
 * Provides both the service implementation and the port adapter
 */
export const SystemCommunicationLive = (config?: any) =>
  Layer.provide(
    SystemCommunicationAdapter,
    SystemCommunicationServiceLive(config)
  )