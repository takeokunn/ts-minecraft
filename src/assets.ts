import { TextureLoader, MeshBasicMaterial, Vector3 } from 'three'

import { BLOCK } from '@src/constant'

export const color = {
  sky: 0x00ffff,
  black: 0x000000,
}

const images = {
  dart: {
    side: 'assets/dart/side.jpeg',
  },
  grass: {
    top: 'assets/grass/top.jpeg',
    side: 'assets/grass/side.jpeg',
    bottom: 'assets/grass/bottom.jpeg',
  },
}

const loader = new TextureLoader()

export const texture: TextureType = {
  dart: [
    {
      name: 'left',
      material: new MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
    {
      name: 'right',
      material: new MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
    {
      name: 'top',
      material: new MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
    {
      name: 'bottom',
      material: new MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
    {
      name: 'back',
      material: new MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
    {
      name: 'front',
      material: new MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    },
  ],
  grass: [
    {
      name: 'left',
      material: new MeshBasicMaterial({ map: loader.load(images.grass.side) }),
    },
    {
      name: 'right',
      material: new MeshBasicMaterial({ map: loader.load(images.grass.side) }),
    },
    {
      name: 'top',
      material: new MeshBasicMaterial({ map: loader.load(images.grass.top) }),
    },
    {
      name: 'bottom',
      material: new MeshBasicMaterial({ map: loader.load(images.grass.bottom) }),
    },
    {
      name: 'back',
      material: new MeshBasicMaterial({ map: loader.load(images.grass.side) }),
    },
    {
      name: 'front',
      material: new MeshBasicMaterial({ map: loader.load(images.grass.side) }),
    },
  ],
}

export const faces: BlockFace[] = [
  {
    name: 'left',
    direction: new Vector3(BLOCK.SIZE, 0, 0),
  },
  {
    name: 'right',
    direction: new Vector3(-BLOCK.SIZE, 0, 0),
  },
  {
    name: 'top',
    direction: new Vector3(0, BLOCK.SIZE, 0),
  },
  {
    name: 'bottom',
    direction: new Vector3(0, -BLOCK.SIZE, 0),
  },
  {
    name: 'back',
    direction: new Vector3(0, 0, BLOCK.SIZE),
  },
  {
    name: 'front',
    direction: new Vector3(0, 0, -BLOCK.SIZE),
  },
]
