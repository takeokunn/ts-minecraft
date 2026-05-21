import { Data } from 'effect';
export class ChunkError extends Data.TaggedError('ChunkError') {
    get message() {
        const localPosStr = this.localPosition
            ? ` at local (${this.localPosition[0]}, ${this.localPosition[1]}, ${this.localPosition[2]})`
            : '';
        return `Chunk error at (${this.chunkCoord.x}, ${this.chunkCoord.z})${localPosStr}: ${this.reason}`;
    }
}
//# sourceMappingURL=../../../dist/packages/terrain/domain/errors.js.map