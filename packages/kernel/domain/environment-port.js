import { Context } from 'effect';
// Decouples application services from `window.location` and DOM globals.
// Wired to a browser-backed implementation via `EnvironmentLive` in src/layers.ts.
export class EnvironmentPort extends Context.Tag('@minecraft/env/EnvironmentPort')() {
}
//# sourceMappingURL=environment-port.js.map