import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { color } from './assets';
import { BLOCK, TERRIAN, CAMERA } from './constant';
var Game = /** @class */ (function () {
    function Game() {
        var _this = this;
        // for stats
        this.stats = Stats();
        this.stats.showPanel(0);
        document.body.appendChild(this.stats.dom);
        // for scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(color.sky);
        // for renderer
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        // for camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.x = ((CAMERA.RENDER_DISTANCE * TERRIAN.CHUNK_SIZE) / 2) * BLOCK.SIZE;
        this.camera.position.z = ((CAMERA.RENDER_DISTANCE * TERRIAN.CHUNK_SIZE) / 2) * BLOCK.SIZE;
        this.camera.position.y = 100;
        // for control
        this.controls = new PointerLockControls(this.camera, document.body);
        document.body.addEventListener('click', function () { return _this.controls.lock(); });
        // resize event
        window.addEventListener('resize', this.handleResizeWindow.bind(this));
    }
    Game.prototype.loop = function (update) {
        requestAnimationFrame(this.loop.bind(this, update));
        this.stats.begin();
        update();
        this.render();
        this.stats.end();
    };
    Game.prototype.addChunksToScene = function (chunks) {
        var _this = this;
        chunks.forEach(function (chunk) {
            chunk.forEach(function (block) {
                var _a = block.display(), blockMesh = _a.blockMesh, lineSegment = _a.lineSegment;
                _this.scene.add(blockMesh);
                _this.scene.add(lineSegment);
            });
        });
    };
    Game.prototype.render = function () {
        this.renderer.render(this.scene, this.camera);
    };
    Game.prototype.handleResizeWindow = function () {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    };
    return Game;
}());
export { Game };
