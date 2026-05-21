import { Data } from 'effect';
const formatCause = (cause) => cause instanceof Error ? cause.message : cause ? String(cause) : '';
export class StorageError extends Data.TaggedError('StorageError') {
    get message() {
        const causeMessage = formatCause(this.cause);
        return `Storage operation '${this.operation}' failed${causeMessage ? `: ${causeMessage}` : ''}`;
    }
}
//# sourceMappingURL=../../../dist/packages/world-state/domain/errors.js.map