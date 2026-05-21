import { Schema } from 'effect';
declare const PlayerHealth_base: Schema.Class<PlayerHealth, {
    current: Schema.filter<Schema.filter<typeof Schema.Number>>;
    max: Schema.filter<Schema.filter<typeof Schema.Number>>;
    invincibilityTicks: Schema.filter<Schema.filter<typeof Schema.Number>>;
}, Schema.Struct.Encoded<{
    current: Schema.filter<Schema.filter<typeof Schema.Number>>;
    max: Schema.filter<Schema.filter<typeof Schema.Number>>;
    invincibilityTicks: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>, never, {
    readonly current: number;
} & {
    readonly max: number;
} & {
    readonly invincibilityTicks: number;
}, {}, {}>;
export declare class PlayerHealth extends PlayerHealth_base {
}
export declare const PlayerHealthInvariant: Schema.filter<typeof PlayerHealth>;
export {};
//# sourceMappingURL=player-health.d.ts.map