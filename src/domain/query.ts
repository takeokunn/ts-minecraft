import { type ComponentName } from './components'

export type Query<T extends ReadonlyArray<ComponentName> = ReadonlyArray<ComponentName>> = {
  readonly name: string
  readonly components: T
  readonly set: ReadonlySet<ComponentName>
}

export const createQuery = <T extends ReadonlyArray<ComponentName>>(name: string, components: T): Query<T> => {
  const set = new Set(components)
  return {
    name,
    components,
    set,
  }
}