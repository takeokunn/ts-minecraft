/**
 * Context.Tag Standards and Utilities
 *
 * This module defines naming conventions and utilities for Context.Tag definitions
 * to ensure consistency across the codebase.
 */

/**
 * NAMING CONVENTIONS:
 *
 * 1. Service Tags should match the variable name:
 *    ✅ export const UserService = Context.GenericTag<UserServiceInterface>('UserService')
 *    ❌ export const UserService = Context.GenericTag<UserServiceInterface>('user-service')
 *
 * 2. Port Tags should use PascalCase with consistent "Port" suffix:
 *    ✅ export const DatabasePort = Context.GenericTag<IDatabasePort>('DatabasePort')
 *    ❌ export const DatabasePort = Context.GenericTag<IDatabasePort>('database-port')
 *
 * 3. Domain Services should include "DomainService" suffix:
 *    ✅ export const WorldDomainService = Context.GenericTag<IWorldDomainService>('WorldDomainService')
 *    ❌ export const WorldService = Context.GenericTag<IWorldService>('WorldService')
 *
 * 4. Infrastructure Services should include "Service" suffix:
 *    ✅ export const RenderService = Context.GenericTag<IRenderService>('RenderService')
 *
 * 5. Adapters should include "Adapter" suffix:
 *    ✅ export const WebGPUAdapter = Context.GenericTag<IWebGPUAdapter>('WebGPUAdapter')
 *
 * 6. Avoid path-style tags except for special cases (e.g., namespaced services):
 *    ✅ export const UserService = Context.GenericTag<IUserService>('UserService')
 *    ⚠️  export const UserService = Context.GenericTag<IUserService>('@domain/UserService') // only for namespaced services
 *
 * 7. Controllers should include "Controller" suffix:
 *    ✅ export const GameController = Context.GenericTag<IGameController>('GameController')
 *
 * 8. Repositories should include "Repository" suffix:
 *    ✅ export const UserRepository = Context.GenericTag<IUserRepository>('UserRepository')
 */

import { Context } from 'effect'

/**
 * Utility type for creating properly typed Context Tags
 */
export type ContextTag<T, S = T> = Context.Tag<T, S>

/**
 * Helper function to create a Context.GenericTag with consistent naming
 */
export const createContextTag = <T>(name: string) => Context.GenericTag<T>(name)

/**
 * Helper function to create a domain service tag with consistent naming
 */
export const createDomainServiceTag = <T>(serviceName: string) => Context.GenericTag<T>(`${serviceName}DomainService`)

/**
 * Helper function to create a port tag with consistent naming
 */
export const createPortTag = <T>(portName: string) => Context.GenericTag<T>(`${portName}Port`)

/**
 * Helper function to create an infrastructure service tag with consistent naming
 */
export const createServiceTag = <T>(serviceName: string) => Context.GenericTag<T>(`${serviceName}Service`)

/**
 * Helper function to create an adapter tag with consistent naming
 */
export const createAdapterTag = <T>(adapterName: string) => Context.GenericTag<T>(`${adapterName}Adapter`)

/**
 * Helper function to create a repository tag with consistent naming
 */
export const createRepositoryTag = <T>(repositoryName: string) => Context.GenericTag<T>(`${repositoryName}Repository`)

/**
 * Helper function to create a controller tag with consistent naming
 */
export const createControllerTag = <T>(controllerName: string) => Context.GenericTag<T>(`${controllerName}Controller`)

/**
 * Validation function to check if a tag name follows conventions
 */
export const validateTagName = (tagName: string, expectedType: 'service' | 'port' | 'adapter' | 'repository' | 'controller' | 'domain-service'): boolean => {
  const patterns = {
    service: /^[A-Z][a-zA-Z]*Service$/,
    port: /^[A-Z][a-zA-Z]*Port$/,
    adapter: /^[A-Z][a-zA-Z]*Adapter$/,
    repository: /^[A-Z][a-zA-Z]*Repository$/,
    controller: /^[A-Z][a-zA-Z]*Controller$/,
    'domain-service': /^[A-Z][a-zA-Z]*DomainService$/,
  }

  return patterns[expectedType].test(tagName)
}

/**
 * Get suggested tag name based on type
 */
export const suggestTagName = (baseName: string, type: 'service' | 'port' | 'adapter' | 'repository' | 'controller' | 'domain-service'): string => {
  const suffixes = {
    service: 'Service',
    port: 'Port',
    adapter: 'Adapter',
    repository: 'Repository',
    controller: 'Controller',
    'domain-service': 'DomainService',
  }

  // Convert to PascalCase if needed
  const pascalBaseName = baseName.charAt(0).toUpperCase() + baseName.slice(1)

  // Remove existing suffix if present
  const cleanBaseName = pascalBaseName.replace(/(Service|Port|Adapter|Repository|Controller|DomainService)$/, '')

  return `${cleanBaseName}${suffixes[type]}`
}

/**
 * Common Context.Tag exports for frequently used services
 */
export const StandardTags = {
  // Infrastructure Services
  ClockService: 'ClockService',
  RenderService: 'RenderService',
  InputService: 'InputService',
  AudioService: 'AudioService',
  NetworkService: 'NetworkService',

  // Domain Services
  WorldDomainService: 'WorldDomainService',
  PhysicsDomainService: 'PhysicsDomainService',
  EntityDomainService: 'EntityDomainService',

  // Ports
  RenderPort: 'RenderPort',
  InputPort: 'InputPort',
  DatabasePort: 'DatabasePort',
  NetworkPort: 'NetworkPort',

  // Adapters
  WebGPUAdapter: 'WebGPUAdapter',
  ThreeJsAdapter: 'ThreeJsAdapter',
  WebSocketAdapter: 'WebSocketAdapter',

  // Repositories
  UserRepository: 'UserRepository',
  WorldRepository: 'WorldRepository',
  EntityRepository: 'EntityRepository',

  // Controllers
  GameController: 'GameController',
  UIController: 'UIController',
  DebugController: 'DebugController',
} as const
