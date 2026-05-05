import { Schema } from 'effect';
export declare const WorldIdSchema: Schema.brand<typeof Schema.String, "WorldId">;
export type WorldId = Schema.Schema.Type<typeof WorldIdSchema>;
export declare const WorldId: {
    make: (s: string) => WorldId;
};
export declare const PlayerIdSchema: Schema.brand<typeof Schema.String, "PlayerId">;
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>;
export declare const PlayerId: {
    make: (s: string) => PlayerId;
};
export declare const BlockIdSchema: Schema.brand<typeof Schema.String, "BlockId">;
export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>;
export declare const BlockId: {
    make: (s: string) => BlockId;
};
export declare const PhysicsBodyIdSchema: Schema.brand<typeof Schema.String, "PhysicsBodyId">;
export type PhysicsBodyId = Schema.Schema.Type<typeof PhysicsBodyIdSchema>;
export declare const PhysicsBodyId: {
    make: (s: string) => PhysicsBodyId;
};
export declare const RecipeIdSchema: Schema.brand<typeof Schema.String, "RecipeId">;
export type RecipeId = Schema.Schema.Type<typeof RecipeIdSchema>;
export declare const RecipeId: {
    make: (s: string) => RecipeId;
};
//# sourceMappingURL=ids.d.ts.map