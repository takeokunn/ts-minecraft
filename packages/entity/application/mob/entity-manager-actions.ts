import * as HashMap from 'effect/HashMap'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'

import type { Entity, EntityId } from '../../domain/mob/entity'
import type { ManagedEntity } from '../../domain/mob/entity-internal'
import { makeEntityManagerCombatActions } from './entity-manager-combat-actions'
import { makeEntityManagerFireActions } from './entity-manager-fire-actions'
import { makeEntityManagerLivestockActions } from './entity-manager-livestock-actions'

export const makeEntityManagerActions = (
  entitiesRef: Ref.Ref<HashMap.HashMap<EntityId, ManagedEntity>>,
  cachedEntitiesRef: Ref.Ref<Option.Option<ReadonlyArray<Entity>>>,
  structureVersionRef: Ref.Ref<number>,
) => ({
  ...makeEntityManagerCombatActions(entitiesRef, cachedEntitiesRef, structureVersionRef),
  ...makeEntityManagerFireActions(entitiesRef, cachedEntitiesRef),
  ...makeEntityManagerLivestockActions(entitiesRef, cachedEntitiesRef),
})
