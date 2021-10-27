import * as THREE from 'three';
import { BLOCK } from '@src/constant';
export var color = {
    sky: 0x00ffff,
};
var images = {
    dart: {
        top: 'assets/dart/top.jpeg',
        side: 'assets/dart/side.jpeg',
        bottom: 'assets/dart/bottom.jpeg',
    },
};
var loader = new THREE.TextureLoader();
export var texture = {
    dart: [
        {
            name: 'left',
            material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
        },
        {
            name: 'right',
            material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
        },
        {
            name: 'top',
            material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.top) }),
        },
        {
            name: 'bottom',
            material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.bottom) }),
        },
        {
            name: 'back',
            material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
        },
        {
            name: 'front',
            material: new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
        },
    ],
};
export var faces = [
    {
        name: 'left',
        direction: new THREE.Vector3(BLOCK.SIZE, 0, 0),
    },
    {
        name: 'right',
        direction: new THREE.Vector3(-BLOCK.SIZE, 0, 0),
    },
    {
        name: 'top',
        direction: new THREE.Vector3(0, BLOCK.SIZE, 0),
    },
    {
        name: 'bottom',
        direction: new THREE.Vector3(0, -BLOCK.SIZE, 0),
    },
    {
        name: 'back',
        direction: new THREE.Vector3(0, 0, BLOCK.SIZE),
    },
    {
        name: 'front',
        direction: new THREE.Vector3(0, 0, -BLOCK.SIZE),
    },
];
