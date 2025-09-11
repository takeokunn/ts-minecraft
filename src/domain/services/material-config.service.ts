/**
 * Material Configuration Service
 * 
 * Simplified export of material configuration domain service
 * for easier access with kebab-case naming convention.
 */

export * from '@domain/services/material-config-domain.service'
export { 
  MaterialConfigDomainServiceLive as MaterialConfigServiceLive,
  MaterialConfigDomainServicePort as MaterialConfigServicePort
} from '@domain/services/material-config-domain.service'