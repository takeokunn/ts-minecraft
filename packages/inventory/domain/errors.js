// Domain error types — all extend Data.TaggedError for typed Effect.catchTag handling.
import { Data } from 'effect';
export class InventoryError extends Data.TaggedError('InventoryError') {
    get message() {
        return this.cause
            ? `Inventory error [${this.operation}]: ${String(this.cause)}`
            : `Inventory error [${this.operation}]`;
    }
}
export class RecipeError extends Data.TaggedError('RecipeError') {
    get message() {
        return this.cause
            ? `Recipe error [${this.operation}]: ${String(this.cause)}`
            : `Recipe error [${this.operation}]`;
    }
}
//# sourceMappingURL=errors.js.map