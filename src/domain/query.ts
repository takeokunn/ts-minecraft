import { type ComponentName, type ComponentOfName } from './components'

export type Query<T extends ReadonlyArray<ComponentName> = ReadonlyArray<ComponentName>> = {
  readonly name: string
  readonly components: T
  readonly set: ReadonlySet<ComponentName>
}

export type QueryResult<T extends ReadonlyArray<ComponentName>> = {
  [K in keyof T]: T[K] extends ComponentName ? ComponentOfName<T[K]> : T[K]
}

export const createQuery = <T extends ReadonlyArray<ComponentName>>(name: string, components: T): Query<T> => {
  const set = new Set(components)
  return {
    name,
    components,
    set,
  }
}
