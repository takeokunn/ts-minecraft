import { Array as Arr, HashMap, Option } from 'effect';
import { SLOT_COLORS, DEFAULT_SLOT_COLOR, getTileImageUrl } from './inventory-renderer.config';
/* c8 ignore next 2 */
export const getSlotColor = (itemType) => Option.getOrElse(Option.fromNullable(SLOT_COLORS[itemType]), () => DEFAULT_SLOT_COLOR);
export const getSlotImageStyle = (itemType) => {
    const url = getTileImageUrl(itemType);
    return url ? `url('${url}')` : null;
};
export const collectAvailableCounts = (slots) => Arr.reduce(slots, HashMap.empty(), (counts, slot) => Option.match(slot, {
    onNone: () => counts,
    onSome: (stack) => HashMap.set(counts, stack.itemType, Option.getOrElse(HashMap.get(counts, stack.itemType), () => 0) + stack.count),
}));
//# sourceMappingURL=../../../../dist/packages/app/presentation/inventory/inventory-renderer-helpers.js.map