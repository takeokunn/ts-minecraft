import { Schema } from 'effect';
export declare const ColorSchema: Schema.Struct<{
    r: Schema.filter<Schema.filter<typeof Schema.Number>>;
    g: Schema.filter<Schema.filter<typeof Schema.Number>>;
    b: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>;
export type Color = Schema.Schema.Type<typeof ColorSchema>;
export declare const makeColor: (r: number, g: number, b: number) => Color;
export declare const fromHex: (hex: string) => Color;
//# sourceMappingURL=color.d.ts.map