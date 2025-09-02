import {
  ComponentSchemas,
  type AnyComponent,
  type ComponentClass,
  type ComponentName,
  type Components,
} from './components'

export type Query<T extends readonly ComponentName[] = readonly ComponentName[]> = {
  readonly name: string
  readonly components: T
  readonly set: ReadonlySet<ComponentName>
  readonly schemas: readonly ComponentClass<AnyComponent>[]
}

export const createQuery = <T extends readonly ComponentName[]>(
  name: string,
  components: T,
): Query<T> => {
  const set = new Set(components)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schemas = components.map((name) => ComponentSchemas[name]) as any
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