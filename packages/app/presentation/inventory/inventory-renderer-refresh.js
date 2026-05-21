import { Array as Arr, Option } from 'effect';
import { HOTBAR_START } from '@ts-minecraft/inventory';
import { getSlotColor, getSlotImageStyle } from './inventory-renderer-helpers';
import { DEFAULT_SLOT_COLOR, EMPTY_RECIPE_STYLE, RECIPE_ROW_BASE_STYLE, RECIPE_ROW_SELECTED_BG, RECIPE_ROW_SELECTED_BORDER, RECIPE_ROW_DEFAULT_BG, RECIPE_ROW_DEFAULT_BORDER, SLOT_BORDER_SELECTED, SLOT_BORDER_DEFAULT, } from './inventory-renderer.config';
/* c8 ignore start */
export const renderSlotElements = (slotEls, allSlots, selectedHotbarIdx) => {
    Arr.forEach(Arr.zip(slotEls, allSlots), ([el, itemOpt], i) => {
        Option.match(itemOpt, {
            onSome: (stack) => {
                const imageStyle = getSlotImageStyle(stack.itemType);
                if (imageStyle) {
                    el.style.cssText = el.style.cssText.replace(/background:[^;]+;?/, '');
                    el.style.backgroundImage = imageStyle;
                    el.style.backgroundSize = 'cover';
                }
                else {
                    el.style.backgroundImage = '';
                    el.style.background = getSlotColor(stack.itemType);
                }
                el.title = `${stack.itemType} ×${stack.count}`;
                el.textContent = stack.count < 64 ? String(stack.count) : '';
            },
            onNone: () => {
                el.style.backgroundImage = '';
                el.style.background = DEFAULT_SLOT_COLOR;
                el.title = '';
                el.textContent = '';
            },
        });
        el.style.border = i >= HOTBAR_START && i === selectedHotbarIdx
            ? SLOT_BORDER_SELECTED
            : SLOT_BORDER_DEFAULT;
    });
};
export const renderCraftingList = (dom, craftingListEl, craftableRecipes, selectedRecipeIndex) => {
    Option.map(craftingListEl, (container) => {
        container.innerHTML = '';
        if (craftableRecipes.length === 0) {
            const empty = dom.createElement('div');
            empty.textContent = 'No craftable recipes yet.';
            empty.style.cssText = EMPTY_RECIPE_STYLE;
            dom.appendChildTo(container, empty);
            return;
        }
        Arr.forEach(craftableRecipes, (recipe, index) => {
            const row = dom.createElement('button');
            row.dataset['recipeId'] = recipe.id;
            const isSelected = index === selectedRecipeIndex;
            row.style.cssText = [
                RECIPE_ROW_BASE_STYLE,
                'border:1px solid ' + (isSelected ? RECIPE_ROW_SELECTED_BORDER : RECIPE_ROW_DEFAULT_BORDER),
                'background:' + (isSelected ? RECIPE_ROW_SELECTED_BG : RECIPE_ROW_DEFAULT_BG),
            ].join(';');
            const stationLabel = recipe.station === 'crafting_table'
                ? ' [Crafting Table]'
                : recipe.station === 'furnace'
                    ? ' [Furnace]'
                    : '';
            row.textContent = `${Arr.map(recipe.ingredients, (ingredient) => `${ingredient.count} ${ingredient.itemType}`).join(' + ')} → ${recipe.output.count} ${recipe.output.itemType}${stationLabel}`;
            dom.appendChildTo(container, row);
        });
    });
};
export const renderStatusEl = (statusEl, statusMessage) => {
    Option.map(statusEl, (el) => {
        el.textContent = statusMessage;
    });
};
/* c8 ignore stop */
//# sourceMappingURL=../../../../dist/packages/app/presentation/inventory/inventory-renderer-refresh.js.map