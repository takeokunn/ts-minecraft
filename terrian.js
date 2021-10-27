import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';
import { BLOCK, TERRIAN } from '@src/constant';
import { Dart } from '@src/blocks';
var Terrian = /** @class */ (function () {
    function Terrian() {
        this.chunks = [];
        this.simplex = new SimplexNoise(Math.random());
    }
    Terrian.prototype.generate = function (centerX, centerZ) {
        for (var x = 0; x < TERRIAN.CHUNK_SIZE * 2; x++) {
            for (var z = 0; z < TERRIAN.CHUNK_SIZE * 2; z++) {
                var xoff = TERRIAN.INCREMENT_OFFSET * x;
                var zoff = TERRIAN.INCREMENT_OFFSET * z;
                var y = Math.round((Math.abs(this.simplex.noise2D(xoff, zoff)) * TERRIAN.AMPLITUDE) / BLOCK.SIZE);
                this.chunks.push(new Dart(new THREE.Vector3(centerX + x * BLOCK.SIZE, y * BLOCK.SIZE, centerZ + z * BLOCK.SIZE), false));
                this.chunks.push(new Dart(new THREE.Vector3(centerX + x * BLOCK.SIZE, (y - 1) * BLOCK.SIZE, centerZ + z * BLOCK.SIZE), true));
            }
        }
    };
    return Terrian;
}());
export { Terrian };
