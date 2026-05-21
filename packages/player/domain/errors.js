// Domain error types — all extend Data.TaggedError for typed Effect.catchTag handling.
import { Data } from 'effect';
export class PlayerError extends Data.TaggedError('PlayerError') {
    get message() {
        return `Player error for '${this.playerId}': ${this.reason}`;
    }
}
export class CameraError extends Data.TaggedError('CameraError') {
    get message() {
        const causeMessage = this.cause instanceof Error ? this.cause.message : this.cause ? String(this.cause) : '';
        return `Camera creation failed${causeMessage ? `: ${causeMessage}` : ''}`;
    }
}
//# sourceMappingURL=../../../dist/packages/player/domain/errors.js.map