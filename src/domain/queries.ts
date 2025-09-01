import { type Query } from './query';

export const playerQuery: Query = {
  name: 'player',
  components: [
    'player',
    'position',
    'velocity',
    'inputState',
    'cameraState',
    'hotbar',
  ],
};

export const physicsQuery: Query = {
  name: 'physics',
  components: ['position', 'velocity', 'gravity'],
};

export const playerColliderQuery: Query = {
  name: 'playerCollider',
  components: ['player', 'position', 'velocity', 'collider'],
};

export const positionColliderQuery: Query = {
  name: 'positionCollider',
  components: ['position', 'collider'],
};

export const chunkQuery: Query = {
  name: 'chunk',
  components: ['chunk'],
};

export const chunkLoaderQuery: Query = {
  name: 'chunkLoader',
  components: ['chunkLoaderState'],
};

export const playerTargetQuery: Query = {
  name: 'playerTarget',
  components: ['player', 'target'],
};

export const playerMovementQuery: Query = {
  name: 'playerMovement',
  components: ['player', 'velocity', 'inputState', 'cameraState'],
};

export const queries = [
  playerQuery,
  physicsQuery,
  playerColliderQuery,
  positionColliderQuery,
  chunkQuery,
  chunkLoaderQuery,
  playerTargetQuery,
  playerMovementQuery,
];
