import { BLOCK } from './constant';
export var isCollideCameraAndBlock = function (camera, block) {
    return (camera.position.x <= block.position.x + BLOCK.SIZE / 2 &&
        camera.position.x >= block.position.x - BLOCK.SIZE / 2 &&
        camera.position.z <= block.position.z + BLOCK.SIZE / 2 &&
        camera.position.z >= block.position.z - BLOCK.SIZE / 2);
};
