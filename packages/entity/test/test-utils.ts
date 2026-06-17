import { Option } from 'effect'

export const expectSome = <A>(option: Option.Option<A>): A => Option.getOrThrow(option)
