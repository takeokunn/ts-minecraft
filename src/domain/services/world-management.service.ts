/**
 * World Management Service
 * 
 * Simplified export of world management domain service
 * for easier access with kebab-case naming convention.
 */

export * from './world-management-domain.service'
export { 
  WorldManagementDomainService as WorldManagementService,
  WorldManagementDomainServiceLive as WorldManagementServiceLive,
  WorldManagementDomainServicePort as WorldManagementServicePort 
} from './world-management-domain.service'