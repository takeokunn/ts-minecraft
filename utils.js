import { faces } from '@src/assets';
import { BLOCK } from '@src/constant';
export var isCollideCameraAndBlock = function (camera, block) {
    return (camera.position.x <= block.position.x + BLOCK.SIZE / 2 &&
        camera.position.x >= block.position.x - BLOCK.SIZE / 2 &&
        camera.position.z <= block.position.z + BLOCK.SIZE / 2 &&
        camera.position.z >= block.position.z - BLOCK.SIZE / 2);
};
var isNeighborhood = function (x, y, z, chunks) {
    return chunks.reduce(function (accum, block) { return accum || (x === block.position.x && y === block.position.y && z === block.position.z); }, false);
};
export var adjustBlockFaces = function (block, chunks) {
    return faces
        .filter(function (face) {
        return isNeighborhood(block.position.x + face.direction.x, block.position.y + face.direction.y, block.position.z + face.direction.z, chunks);
    })
        .map(function (face) { return face.name; });
};
