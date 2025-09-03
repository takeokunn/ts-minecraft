import { Data, HashMap, HashSet } from 'effect'
import { ComponentName, EntityId } from './types'
import { Components } from './components'
import { PlacedBlock } from './block'
import { Chunk } from './components'

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

export type ComponentStorage = {
  readonly [K in ComponentName]: HashMap.HashMap<EntityId, Components[K]>
}

export type ArchetypeStorage = HashMap.HashMap<string, HashSet.HashSet<EntityId>>

export interface WorldState {
  readonly nextEntityId: number
  readonly entities: HashMap.HashMap<EntityId, string> // Map<EntityId, ArchetypeKey>
  readonly archetypes: ArchetypeStorage
  readonly components: ComponentStorage
  readonly chunks: HashMap.HashMap<string, Chunk>
}