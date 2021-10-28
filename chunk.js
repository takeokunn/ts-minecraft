import * as THREE from 'three';
import { BLOCK, TERRIAN } from '@src/constant';
import { Dart, Grass } from '@src/blocks';
var Chunk = /** @class */ (function () {
    function Chunk(simplex, centerX, centerZ) {
        this.blocks = [];
        for (var x = 0; x < TERRIAN.CHUNK_SIZE; x++) {
            for (var z = 0; z < TERRIAN.CHUNK_SIZE; z++) {
                var positionX = centerX + x;
                var positionZ = centerZ + z;
                var xoff = TERRIAN.INCREMENT_OFFSET * positionX;
                var zoff = TERRIAN.INCREMENT_OFFSET * positionZ;
                var y = Math.round((simplex.noise2D(xoff, zoff) * TERRIAN.AMPLITUDE) / BLOCK.SIZE);
                this.blocks.push(new Grass(new THREE.Vector3(positionX * BLOCK.SIZE, y * BLOCK.SIZE, positionZ * BLOCK.SIZE), true));
                this.blocks.push(new Dart(new THREE.Vector3(positionX * BLOCK.SIZE, (y - 1) * BLOCK.SIZE, positionZ * BLOCK.SIZE), false));
            }
        }
    }
    return Chunk;
}());
export { Chunk };
