/**
 * World Management Service
 * 
 * Simplified export of world management domain service
 * for easier access with kebab-case naming convention.
 */

export * from '@domain/services/world-management-domain.service'
export { 
  WorldManagementDomainService as WorldManagementService,
  WorldManagementDomainServiceLive as WorldManagementServiceLive,
  WorldManagementDomainServicePort as WorldManagementServicePort 
} from '@domain/services/world-management-domain.service'