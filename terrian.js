import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';
import { Dart } from '@src/blocks';
import { BLOCK, TERRIAN, CAMERA } from './constant';
var Terrian = /** @class */ (function () {
    function Terrian() {
        this.chunks = [];
        this.simplex = new SimplexNoise(Math.random());
    }
    Terrian.prototype.generate = function (xoff, zoff) {
        for (var outer = 0; outer < CAMERA.RENDER_DISTANCE; outer++) {
            for (var inner = 0; inner < CAMERA.RENDER_DISTANCE; inner++) {
                for (var x = outer * TERRIAN.CHUNK_SIZE; x < outer * TERRIAN.CHUNK_SIZE + TERRIAN.CHUNK_SIZE; x++) {
                    for (var z = inner * TERRIAN.CHUNK_SIZE; z < inner * TERRIAN.CHUNK_SIZE + TERRIAN.CHUNK_SIZE; z++) {
                        xoff = TERRIAN.INCREMENT_OFFSET * x;
                        zoff = TERRIAN.INCREMENT_OFFSET * z;
                        var y = Math.round((Math.abs(this.simplex.noise2D(xoff, zoff)) * TERRIAN.AMPLITUDE) / BLOCK.SIZE);
                        this.chunks.push(new Dart(new THREE.Vector3(x * BLOCK.SIZE, y * BLOCK.SIZE, z * BLOCK.SIZE), false));
                        this.chunks.push(new Dart(new THREE.Vector3(x * BLOCK.SIZE, (y - 1) * BLOCK.SIZE, z * BLOCK.SIZE), true));
                    }
                }
            }
        }
    };
    return Terrian;
}());
export { Terrian };
