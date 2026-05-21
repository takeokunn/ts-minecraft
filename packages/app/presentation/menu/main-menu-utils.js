import { WorldId } from '@ts-minecraft/kernel';
export const formatLastPlayed = (date) => {
    try {
        return date.toLocaleString();
    }
    catch {
        return date.toISOString();
    }
};
export const cycleGameMode = (mode) => (mode === 'survival' ? 'creative' : 'survival');
export const generateWorldId = () => WorldId.make(`world-${Date.now()}-${Math.floor(Math.random() * 10_000)}`);
//# sourceMappingURL=../../../../dist/packages/app/presentation/menu/main-menu-utils.js.map