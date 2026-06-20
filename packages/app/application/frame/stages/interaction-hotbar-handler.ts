import { Effect } from 'effect'
import type { FrameHotbarHudServices, FrameHotbarInputServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/hotbar'

export const handleHotbarInput = (
  services: FrameHotbarInputServices,
): Effect.Effect<void, never> =>
  // Update hotbar slot selection (keyboard 1-9 and mouse wheel)
  services.hotbarService.update()

export const renderHotbarHud = (
  services: FrameHotbarHudServices,
): Effect.Effect<void, never> =>
  services.hotbarService.getSlots().pipe(
    Effect.flatMap((slots) =>
      services.hotbarService.getSelectedSlot().pipe(
        Effect.flatMap((selectedSlot) => services.hotbarRenderer.update(slots, selectedSlot)),
      ),
    ),
  )
