import { Brand, Schema } from "effect";

export type EntityId = Brand.Branded<number, "EntityId">;

export const EntityId = Brand.nominal<EntityId>();

export const schema = Schema.Number.pipe(Schema.brand("EntityId"));