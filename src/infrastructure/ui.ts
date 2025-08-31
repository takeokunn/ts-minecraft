import { Effect, Layer, Stream } from 'effect';
import { Hotbar } from '../domain/components';
import { Scene } from '../runtime/game-state';
import { UI } from '../runtime/services';

import { Chunk, Effect, Layer, Stream } from 'effect';
import type { Hotbar } from '../domain/components';
import type { Scene } from '../runtime/game-state';
import { UI } from '../runtime/services';

export const UILive: Layer.Layer<UI> = Layer.succeed(
  UI,
  UI.of({
    setScene: (scene: Scene) =>
      Effect.sync(() => {
        const titleScreen = document.getElementById('titleScreenGUI');
        const gameScreen = document.getElementById('gameScreenGUI');
        const escapeScreen = document.getElementById('escapeScreenGUI');

        if (!titleScreen || !gameScreen || !escapeScreen) {
          return;
        }

        titleScreen.style.display = 'none';
        gameScreen.style.display = 'none';
        escapeScreen.style.display = 'none';

        switch (scene) {
          case 'Title':
            titleScreen.style.display = 'block';
            startTitleAnimation();
            break;
          case 'InGame':
            gameScreen.style.display = 'block';
            stopTitleAnimation();
            break;
          case 'Paused':
            gameScreen.style.display = 'block'; // Show game behind pause menu
            escapeScreen.style.display = 'block';
            stopTitleAnimation();
            break;
        }
      }),

    updateHotbar: (hotbar: Hotbar) =>
      Effect.sync(() => {
        for (let i = 0; i < hotbar.slots.length; i++) {
          const slotElement = document.getElementById(`slot${i + 1}`);
          if (slotElement) {
            // For now, just show the name. Later, we can use images.
            slotElement.textContent = String(hotbar.slots[i] ?? '');
            if (i === hotbar.selectedSlot) {
              slotElement.classList.add('selected');
            } else {
              slotElement.classList.remove('selected');
            }
          }
        }
      }),

    events: {
      newGame: Stream.fromEventListener(
        document.getElementById('newgame')!,
        'click',
      ).pipe(Stream.asVoid),

      loadGame: Stream.async<never, File, never>((emit) => {
        const loadButton = document.getElementById('loadgame')!;
        const fileInput = document.getElementById(
          'inputFile',
        ) as HTMLInputElement;

        const onButtonClick = () => {
          fileInput.click();
        };

        const onFileChange = (event: Event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (file) {
            emit(Effect.succeed(Chunk.of(file)));
          }
        };

        loadButton.addEventListener('click', onButtonClick);
        fileInput.addEventListener('change', onFileChange);

        return Effect.sync(() => {
          loadButton.removeEventListener('click', onButtonClick);
          fileInput.removeEventListener('change', onFileChange);
        });
      }),

      saveGame: Stream.fromEventListener(
        document.getElementById('titlescreensave')!,
        'click',
      ).pipe(Stream.asVoid),

      backToGame: Stream.fromEventListener(
        document.getElementById('backtogame')!,
        'click',
      ).pipe(Stream.asVoid),
    },
  }),
);

// --- Title Screen Animation ---
let currentImageIndex = 0;
let intervalId: NodeJS.Timeout | null = null;

const startTitleAnimation = (): void => {
  const images = document.querySelectorAll('.titleScreenImage');
  if (images.length === 0 || intervalId) return;

  // Ensure first image is active
  images.forEach((img, index) => {
    if (index === currentImageIndex) {
      img.classList.add('active');
    } else {
      img.classList.remove('active');
    }
  });

  intervalId = setInterval(() => {
    images[currentImageIndex]?.classList.remove('active');
    currentImageIndex = (currentImageIndex + 1) % images.length;
    images[currentImageIndex]?.classList.add('active');
  }, 5000);
};

const stopTitleAnimation = (): void => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};


// --- Title Screen Animation ---
let currentImageIndex = 0;
let intervalId: NodeJS.Timeout | null = null;

const startTitleAnimation = (): void => {
  const images = document.querySelectorAll('.titleScreenImage');
  if (images.length === 0 || intervalId) return;

  // Ensure first image is active
  images.forEach((img, index) => {
    if (index === currentImageIndex) {
      img.classList.add('active');
    } else {
      img.classList.remove('active');
    }
  });

  intervalId = setInterval(() => {
    images[currentImageIndex]?.classList.remove('active');
    currentImageIndex = (currentImageIndex + 1) % images.length;
    images[currentImageIndex]?.classList.add('active');
  }, 5000);
};

const stopTitleAnimation = (): void => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};