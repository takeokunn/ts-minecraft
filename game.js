import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { color } from '@src/assets';
import { adjustBlockFaces } from '@src/utils';
import { BLOCK, TERRIAN, CAMERA } from '@src/constant';
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
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, CAMERA.PERSPECTIVE.NEAR);
        this.camera.position.x = (TERRIAN.CHUNK_SIZE / 2) * BLOCK.SIZE;
        this.camera.position.z = (TERRIAN.CHUNK_SIZE / 2) * BLOCK.SIZE;
        this.camera.position.y = CAMERA.INITIALIZE.POSITION_Y;
        // for control
        this.controls = new PointerLockControls(this.camera, document.body);
        document.body.addEventListener('click', function () { return _this.controls.lock(); });
        // for resize event
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
        chunks.forEach(function (block) {
            if (!block.isDisplayable)
                return;
            var blockMesh = block.display(adjustBlockFaces(block, chunks)).blockMesh;
            _this.scene.add(blockMesh);
        });
    };
    Game.prototype.addLineSegmentBlock = function (chunks) {
        var _this = this;
        chunks.forEach(function (block) {
            if (!block.isDisplayable)
                return;
            var lineSegment = block.display(adjustBlockFaces(block, chunks)).lineSegment;
            _this.scene.add(lineSegment);
        });
    };
    Game.prototype.removeLineSegmentBlock = function () {
        var _this = this;
        this.scene.children.filter(function (obj) { return obj.type === 'LineSegments'; }).forEach(function (obj) { return _this.scene.remove(obj); });
    };
    Game.prototype.render = function () {
        this.renderer.render(this.scene, this.camera);
    };
    Game.prototype.handleResizeWindow = function () {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    };
    Game.prototype.setCameraFar = function (far) {
        this.camera.far = far;
        this.camera.updateProjectionMatrix();
    };
    return Game;
}());
export { Game };
