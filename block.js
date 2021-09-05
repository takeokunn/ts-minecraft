import * as THREE from 'three';
import texture from './texture';
import { BLOCK } from './constant';
var Block = /** @class */ (function () {
    function Block(position) {
        this.position = position;
        this.box = new THREE.BoxBufferGeometry(BLOCK.SIZE, BLOCK.SIZE, BLOCK.SIZE);
    }
    Block.prototype.display = function () {
        var blockMesh = this.displayBlock();
        var lineSegment = this.displayLine();
        return { blockMesh: blockMesh, lineSegment: lineSegment };
    };
    Block.prototype.displayBlock = function () {
        var blockMesh = new THREE.Mesh(this.box, texture.dart);
        blockMesh.position.x = this.position.x;
        blockMesh.position.y = this.position.y - BLOCK.SIZE * 2;
        blockMesh.position.z = this.position.z;
        return blockMesh;
    };
    Block.prototype.displayLine = function () {
        var edges = new THREE.EdgesGeometry(this.box);
        var lineSegment = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00000 }));
        lineSegment.position.x = this.position.x;
        lineSegment.position.y = this.position.y - BLOCK.SIZE * 2;
        lineSegment.position.z = this.position.z;
        return lineSegment;
    };
    return Block;
}());
export default Block;
