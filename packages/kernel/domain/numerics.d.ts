import { Schema } from 'effect';
export declare const SlotIndexSchema: Schema.brand<Schema.filter<Schema.filter<typeof Schema.Number>>, "SlotIndex">;
export type SlotIndex = Schema.Schema.Type<typeof SlotIndexSchema>;
export declare const SlotIndex: {
    make: (n: number) => SlotIndex;
    toNumber: (idx: SlotIndex) => number;
};
export declare const DeltaTimeSecsSchema: Schema.brand<Schema.filter<Schema.filter<typeof Schema.Number>>, "DeltaTimeSecs">;
export type DeltaTimeSecs = Schema.Schema.Type<typeof DeltaTimeSecsSchema>;
export declare const DeltaTimeSecs: {
    make: (n: number) => DeltaTimeSecs;
};
export declare const BlockIndexSchema: Schema.brand<Schema.filter<Schema.filter<Schema.filter<typeof Schema.Number>>>, "BlockIndex">;
export type BlockIndex = Schema.Schema.Type<typeof BlockIndexSchema>;
export declare const BlockIndex: {
    make: (n: number) => BlockIndex;
};
//# sourceMappingURL=numerics.d.ts.map