import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'
import { MobDefinitions } from './mob-definitions'

export const getMobDefinition = (entityType: EntityType): MobDefinition => MobDefinitions[entityType]
