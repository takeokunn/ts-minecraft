import { Option } from 'effect';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel';
export const FLUID_BYTE_LENGTH = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;
const FLUID_PRESENT_MASK = 0x80;
const FLUID_SOURCE_MASK = 0x08;
const FLUID_LEVEL_MASK = 0x07;
const FLUID_TYPE_MASK = 0x10;
export const createFluidBuffer = () => new Uint8Array(FLUID_BYTE_LENGTH);
export const encodeFluidCell = (cell) => FLUID_PRESENT_MASK |
    (cell.source ? FLUID_SOURCE_MASK : 0) |
    (cell.type === 'lava' ? FLUID_TYPE_MASK : 0) |
    (cell.level & FLUID_LEVEL_MASK);
export const decodeFluidByte = (byte) => (byte & FLUID_PRESENT_MASK) === 0
    ? Option.none()
    : Option.some({
        level: byte & FLUID_LEVEL_MASK,
        source: (byte & FLUID_SOURCE_MASK) !== 0,
        type: (byte & FLUID_TYPE_MASK) !== 0 ? 'lava' : 'water',
    });
//# sourceMappingURL=../../../dist/packages/world-state/domain/fluid.js.map