import { Context } from 'effect';

export type Resource<T> = Context.Tag<T, T>;

export const makeResource = <T>(name: string) =>
  Context.GenericTag<T>(name);
