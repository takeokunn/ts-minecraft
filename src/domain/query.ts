import { Schema as S } from 'effect'
import {
  ComponentSchemas,
  type ComponentName,
  type Components,
} from './components'

export type Query<T extends readonly ComponentName[] = readonly ComponentName[]> = {
  readonly name: string
  readonly components: T
  readonly set: ReadonlySet<ComponentName>
  readonly schemas: ReadonlyArray<S.Schema<any>>
}

export const createQuery = <T extends readonly ComponentName[]>(name: string, components: T): Query<T> => {
  const set = new Set(components)
  const schemas = components.map((name) => ComponentSchemas[name])
  return {
    name,
    components,
    set,
    schemas,
  }
}

export type QueryResult<T extends readonly ComponentName[]> = {
  readonly [K in T[number]]: Components[K]
}
