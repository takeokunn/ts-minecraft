import * as THREE from 'three';
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
        new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
        new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
        new THREE.MeshBasicMaterial({ map: loader.load(images.dart.top) }),
        new THREE.MeshBasicMaterial({ map: loader.load(images.dart.bottom) }),
        new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
        new THREE.MeshBasicMaterial({ map: loader.load(images.dart.side) }),
    ],
};
