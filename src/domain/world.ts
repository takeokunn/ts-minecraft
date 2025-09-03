import { Data, HashMap, HashSet } from 'effect'
import { PartialComponents, type ComponentName } from './components'
import { PlacedBlock } from './block'
import { Chunk } from './components'
import { EntityId } from './entity'

// --- Error Types ---
export class EntityNotFoundError extends Data.TaggedError('EntityNotFoundError')<{
  readonly entityId: EntityId
}> {}

export class ComponentNotFoundError extends Data.TaggedError('ComponentNotFoundError')<{
  readonly entityId: EntityId
  readonly componentName: ComponentName
}> {}

// --- Data Types ---
export type Voxel = PlacedBlock

type ComponentOfName<K extends ComponentName> = PartialComponents[K]

export type ComponentStorage = {
  readonly [K in ComponentName]: HashMap.HashMap<EntityId, ComponentOfName<K>>
}

export type ArchetypeStorage = HashMap.HashMap<string, HashSet.HashSet<EntityId>>

export interface WorldState {
  readonly nextEntityId: number
  readonly entities: HashMap.HashMap<EntityId, string> // Map<EntityId, ArchetypeKey>
  readonly archetypes: ArchetypeStorage
  readonly components: ComponentStorage
  readonly chunks: HashMap.HashMap<string, Chunk>
}
