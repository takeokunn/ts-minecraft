import { Effect } from 'effect';
export const handleHotbarInput = (services) => 
// Update hotbar slot selection (keyboard 1-9 and mouse wheel)
services.hotbarService.update();
export const renderHotbarHud = (services) => Effect.all([services.hotbarService.getSlots(), services.hotbarService.getSelectedSlot()], { concurrency: 'unbounded' }).pipe(Effect.flatMap(([slots, selectedSlot]) => services.hotbarRenderer.update(slots, selectedSlot)));
//# sourceMappingURL=../../../../../dist/packages/app/application/frame/stages/interaction-hotbar-handler.js.map