// ===== ECS AND QUERY SERVICES =====
export * from './ecs'

// ===== CORE DOMAIN SERVICES =====
export * from './entity-domain.service'
export * from './world-domain.service'
export * from './physics-domain.service'

// ===== SPECIALIZED DOMAIN SERVICES =====
export * from './chunk-loading.service'
export * from './targeting-advanced.service'
export * from './mesh-generation.service'
export * from './material-config.service'
export * from './terrain-generation.service'
export * from './world-management.service'
export * from './world-management-domain.service'

// ===== SERVICE COMPOSITION AND MANAGEMENT =====
export * from './service-composition.layer'
export * from './service-exports'

// ===== LEGACY EXPORTS FOR BACKWARD COMPATIBILITY =====
// Note: These should be gradually migrated to the new service structure
