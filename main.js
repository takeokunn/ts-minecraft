var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import Block from './block';
import Keyboard from './keyboard';
import { BLOCK, TERRIAN, CAMERA, GRAVITY } from './constant';
var simplex = new SimplexNoise(Math.random());
///////////////////////////////////////////////////////////////////////////////
//                          initialize scene/camera                          //
///////////////////////////////////////////////////////////////////////////////
var scene = new THREE.Scene();
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.x = CAMERA.INIT_X;
camera.position.y = CAMERA.INIT_Y;
camera.position.z = CAMERA.INIT_Z;
var controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', function () { return controls.lock(); });
// controls.addEventListener('lock', () => console.log('controls lock'))
// controls.addEventListener('unlock', () => console.log('controls unlock'))
var handleResizeWindow = function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
};
window.addEventListener('resize', handleResizeWindow);
///////////////////////////////////////////////////////////////////////////////
//                              generate terrian                             //
///////////////////////////////////////////////////////////////////////////////
var xoff = 0;
var zoff = 0;
var blocks = [];
for (var x = 0; x < TERRIAN.WIDTH; x++) {
    xoff = 0;
    for (var z = 0; z < TERRIAN.WIDTH; z++) {
        var y = Math.round((Math.abs(simplex.noise2D(xoff, zoff)) * TERRIAN.AMPLITUDE) / BLOCK.SIZE);
        blocks = __spreadArray(__spreadArray([], blocks, true), [new Block(new THREE.Vector3(-1 * x * BLOCK.SIZE, y * BLOCK.SIZE, -1 * z * BLOCK.SIZE))], false);
        xoff += TERRIAN.INCREMENT_OFFSET;
    }
    zoff += TERRIAN.INCREMENT_OFFSET;
}
blocks.forEach(function (block) {
    var _a = block.display(), blockMesh = _a.blockMesh, lineSegment = _a.lineSegment;
    scene.add(blockMesh);
    scene.add(lineSegment);
});
///////////////////////////////////////////////////////////////////////////////
//                                 collision                                 //
///////////////////////////////////////////////////////////////////////////////
var isCollideCameraAndBlock = function (camera, block) {
    return (camera.position.x <= block.position.x + BLOCK.SIZE &&
        camera.position.x >= block.position.x &&
        camera.position.z <= block.position.z + BLOCK.SIZE &&
        camera.position.z >= block.position.z &&
        camera.position.y < block.position.y);
};
///////////////////////////////////////////////////////////////////////////////
//                                 key event                                 //
///////////////////////////////////////////////////////////////////////////////
var ySpeed = 0;
var keymaps = [
    {
        key: 'w',
        callback: function () { return controls.moveForward(CAMERA.MOVING_SPEED); },
    },
    {
        key: 'a',
        callback: function () { return controls.moveRight(-1 * CAMERA.MOVING_SPEED); },
    },
    {
        key: 's',
        callback: function () { return controls.moveForward(-1 * CAMERA.MOVING_SPEED); },
    },
    {
        key: 'd',
        callback: function () { return controls.moveRight(CAMERA.MOVING_SPEED); },
    },
    {
        key: ' ',
        callback: function () { return (ySpeed = -3); },
    },
];
var keyboard = new Keyboard(keymaps);
document.addEventListener('keyup', function (e) { return keyboard.handleKeyUp(e); });
document.addEventListener('keydown', function (e) { return keyboard.handleKeyDown(e); });
///////////////////////////////////////////////////////////////////////////////
//                                 game event                                //
///////////////////////////////////////////////////////////////////////////////
var update = function () {
    // keyboard
    keyboard.dispatch();
    // gravity
    camera.position.y = camera.position.y - ySpeed;
    ySpeed = ySpeed + GRAVITY;
    blocks.forEach(function (block) {
        if (!isCollideCameraAndBlock(camera, block))
            return;
        camera.position.y = block.position.y;
        ySpeed = 0;
    });
};
var render = function () {
    renderer.render(scene, camera);
};
var gameLoop = function () {
    requestAnimationFrame(gameLoop);
    update();
    render();
};
gameLoop();
