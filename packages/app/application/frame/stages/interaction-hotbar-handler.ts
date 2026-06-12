import { Effect } from 'effect'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

export const handleHotbarInput = (
  services: Pick<FrameHandlerServices, 'hotbarService'>,
): Effect.Effect<void, never> =>
  // Update hotbar slot selection (keyboard 1-9 and mouse wheel)
  services.hotbarService.update()

export const renderHotbarHud = (
  services: Pick<FrameHandlerServices, 'hotbarService' | 'hotbarRenderer'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const slots = yield* services.hotbarService.getSlots()
    const selectedSlot = yield* services.hotbarService.getSelectedSlot()
    yield* services.hotbarRenderer.update(slots, selectedSlot)
  })
