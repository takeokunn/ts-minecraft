import * as THREE from 'three';
import { BLOCK } from './constant';
var Block = /** @class */ (function () {
    function Block(vec3) {
        this.vec3 = vec3;
        this.box = new THREE.BoxBufferGeometry(BLOCK.SIZE, BLOCK.SIZE, BLOCK.SIZE);
    }
    Block.prototype.display = function () {
        var blockMesh = this.displayBlock();
        var lineSegment = this.displayLine();
        return { blockMesh: blockMesh, lineSegment: lineSegment };
    };
    Block.prototype.displayBlock = function () {
        var mesh = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        var blockMesh = new THREE.Mesh(this.box, mesh);
        blockMesh.position.x = this.vec3.x;
        blockMesh.position.y = this.vec3.y;
        blockMesh.position.z = this.vec3.z;
        return blockMesh;
    };
    Block.prototype.displayLine = function () {
        var edges = new THREE.EdgesGeometry(this.box);
        var lineSegment = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff }));
        lineSegment.position.x = this.vec3.x;
        lineSegment.position.y = this.vec3.y;
        lineSegment.position.z = this.vec3.z;
        return lineSegment;
    };
    return Block;
}());
export default Block;
