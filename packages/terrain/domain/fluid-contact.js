import { Option } from 'effect';
// Flowing lava + any water → COBBLESTONE; lava source + any water → OBSIDIAN.
export const resolveContact = (lavaCell, waterCell) => {
    if (lavaCell.type !== 'lava' || waterCell.type !== 'water')
        return Option.none();
    if (!lavaCell.source && waterCell.source)
        return Option.some('COBBLESTONE');
    if (!lavaCell.source)
        return Option.some('COBBLESTONE');
    return Option.some('OBSIDIAN');
};
//# sourceMappingURL=../../../dist/packages/terrain/domain/fluid-contact.js.map