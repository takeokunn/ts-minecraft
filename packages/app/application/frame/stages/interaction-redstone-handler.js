import { Effect, Match, Option } from 'effect';
import { RedstoneComponentType } from '@ts-minecraft/entities';
const dispatchRedstoneAction = (services, flags, position) => Match.value(flags).pipe(Match.when({ placeWire: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Wire)), Match.when({ placeLever: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Lever)), Match.when({ placeButton: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Button)), Match.when({ placeTorch: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Torch)), Match.when({ placePiston: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Piston)), Match.when({ toggleLever: true }, () => services.redstoneService.toggleLever(position)), Match.when({ pressButton: true }, () => services.redstoneService.pressButton(position)), Match.when({ toggleTorch: true }, () => services.redstoneService.toggleTorch(position)), Match.orElse(() => Effect.void));
export const handleRedstoneInput = (services, flags, targetBlock) => Effect.gen(function* () {
    yield* Option.match(targetBlock, {
        onNone: () => Effect.void,
        onSome: (tb) => dispatchRedstoneAction(services, flags, { x: tb.x, y: tb.y, z: tb.z }),
    });
    yield* services.redstoneService.tick();
});
//# sourceMappingURL=../../../../../dist/packages/app/application/frame/stages/interaction-redstone-handler.js.map