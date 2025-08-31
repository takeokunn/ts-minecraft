import { Brand } from 'effect';
import { v4 as uuidv4 } from 'uuid';

export type EntityId = Brand.Branded<string, 'EntityId'>;

const nominal = Brand.nominal<EntityId>();

export const Entity = {
  make: (): EntityId => nominal(uuidv4()),
};