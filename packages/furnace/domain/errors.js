import { Data } from 'effect';
export class FurnaceError extends Data.TaggedError('FurnaceError') {
    get message() {
        return this.cause != null
            ? `Furnace error [${this.operation}]: ${String(this.cause)}`
            : `Furnace error [${this.operation}]`;
    }
}
//# sourceMappingURL=../../../dist/packages/furnace/domain/errors.js.map