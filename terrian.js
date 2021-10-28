import SimplexNoise from 'simplex-noise';
import { TERRIAN } from '@src/constant';
import { Chunk } from '@src/chunk';
var Terrian = /** @class */ (function () {
    function Terrian() {
        this.chunks = [];
        this.simplex = new SimplexNoise(Math.random());
    }
    Terrian.prototype.generate = function () {
        this.chunks.push(new Chunk(this.simplex, 0, 0));
        this.chunks.push(new Chunk(this.simplex, -TERRIAN.CHUNK_SIZE, 0));
        this.chunks.push(new Chunk(this.simplex, 0, -TERRIAN.CHUNK_SIZE));
        this.chunks.push(new Chunk(this.simplex, -TERRIAN.CHUNK_SIZE, -TERRIAN.CHUNK_SIZE));
    };
    Terrian.prototype.getChunkBlocks = function () {
        return this.chunks.map(function (chunk) { return chunk.blocks; }).flat();
    };
    return Terrian;
}());
export { Terrian };
