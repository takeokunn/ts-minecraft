// Domain error types — all extend Data.TaggedError for typed Effect.catchTag handling.
import { Data } from 'effect';
const formatCause = (cause) => 
/* c8 ignore next */
cause instanceof Error ? cause.message : cause ? String(cause) : '';
export class TextureError extends Data.TaggedError('TextureError') {
    get message() {
        const causeMessage = formatCause(this.cause);
        return `Failed to load texture from ${this.url}${causeMessage ? `: ${causeMessage}` : ''}`;
    }
}
export class MeshError extends Data.TaggedError('MeshError') {
    get message() {
        const causeMessage = formatCause(this.cause);
        const detailsStr = this.details ? ` (${this.details})` : '';
        return `Mesh generation failed: ${this.reason}${detailsStr}${causeMessage ? `: ${causeMessage}` : ''}`;
    }
}
//# sourceMappingURL=../../../dist/packages/rendering/domain/errors.js.map