import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import Block from './block';
import { BLOCK, TERRIAN } from './constant';
var scene = new THREE.Scene();
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.x = 10;
camera.position.y = 80;
camera.position.z = 10;
var blocks = [];
var simplex = new SimplexNoise(Math.random());
var xoff = 0;
var zoff = 0;
for (var x = 0; x < 50; x++) {
    xoff = 0;
    for (var z = 0; z < 50; z++) {
        var y = Math.round(Math.abs(simplex.noise2D(xoff, zoff)) * TERRIAN.AMPLITUDE / BLOCK.SIZE);
        blocks.push(new Block(new THREE.Vector3(-1 * x * BLOCK.SIZE, y * BLOCK.SIZE, -1 * z * BLOCK.SIZE)));
        xoff += TERRIAN.INCREMENT_OFFSET;
    }
    zoff += TERRIAN.INCREMENT_OFFSET;
}
blocks.forEach(function (block) {
    var _a = block.display(), blockMesh = _a.blockMesh, lineSegment = _a.lineSegment;
    scene.add(blockMesh);
    scene.add(lineSegment);
});
var handleResizeWindow = function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
};
window.addEventListener('resize', handleResizeWindow);
var controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', function () { return controls.lock(); });
controls.addEventListener('lock', function () { return console.log('controls lock'); });
controls.addEventListener('unlock', function () { return console.log('controls unlock'); });
// const update = () => {}
var render = function () {
    renderer.render(scene, camera);
};
var gameLoop = function () {
    requestAnimationFrame(gameLoop);
    // update()
    render();
};
gameLoop();
