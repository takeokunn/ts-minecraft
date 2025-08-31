import { Effect } from 'effect';
import { initializeUI } from './infrastructure/ui';
import { MainLayer } from './main';

// This is the sole entry point of the application.
// It initializes the UI, which in turn will start the game.
const main = initializeUI.pipe(
  Effect.provide(MainLayer),
);

Effect.runFork(main);
