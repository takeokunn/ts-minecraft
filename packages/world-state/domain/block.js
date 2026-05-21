import { Schema } from 'effect';
import { BlockIdSchema, BlockTypeSchema } from '@ts-minecraft/kernel';
export { BlockTypeSchema } from '@ts-minecraft/kernel';
export { BlockIdSchema };
export const BlockPropertiesSchema = Schema.Struct({
    hardness: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
    transparency: Schema.Boolean,
    solid: Schema.Boolean,
    emissive: Schema.Boolean,
    friction: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
});
export const BlockFaceSchema = Schema.Struct({
    top: Schema.Boolean,
    bottom: Schema.Boolean,
    north: Schema.Boolean,
    south: Schema.Boolean,
    east: Schema.Boolean,
    west: Schema.Boolean,
});
export class Block extends Schema.Class('Block')({
    id: BlockIdSchema,
    type: BlockTypeSchema,
    properties: BlockPropertiesSchema,
    faces: BlockFaceSchema,
}) {
}
//# sourceMappingURL=../../../dist/packages/world-state/domain/block.js.map