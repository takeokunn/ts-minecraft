import { Schema } from 'effect';
export const WorldIdSchema = Schema.String.pipe(Schema.brand('WorldId'));
export const WorldId = {
    make: (s) => Schema.decodeUnknownSync(WorldIdSchema)(s),
};
export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'));
export const PlayerId = {
    make: (s) => Schema.decodeUnknownSync(PlayerIdSchema)(s),
};
export const BlockIdSchema = Schema.String.pipe(Schema.brand('BlockId'));
export const BlockId = {
    make: (s) => Schema.decodeUnknownSync(BlockIdSchema)(s),
};
export const PhysicsBodyIdSchema = Schema.String.pipe(Schema.brand('PhysicsBodyId'));
export const PhysicsBodyId = {
    make: (s) => Schema.decodeUnknownSync(PhysicsBodyIdSchema)(s),
};
export const RecipeIdSchema = Schema.String.pipe(Schema.brand('RecipeId'));
export const RecipeId = {
    make: (s) => Schema.decodeUnknownSync(RecipeIdSchema)(s),
};
//# sourceMappingURL=../../../dist/packages/kernel/domain/ids.js.map