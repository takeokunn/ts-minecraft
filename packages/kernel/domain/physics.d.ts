import { Schema } from 'effect';
export declare const MetersPerSecSchema: Schema.brand<Schema.filter<typeof Schema.Number>, "MetersPerSec">;
export type MetersPerSec = Schema.Schema.Type<typeof MetersPerSecSchema>;
export declare const MetersPerSec: {
    make: (n: number) => MetersPerSec;
    toNumber: (v: MetersPerSec) => number;
};
//# sourceMappingURL=physics.d.ts.map