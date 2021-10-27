import { isCollideCameraAndBlock } from './utils';
import { BLOCK, CAMERA, GRAVITY } from './constant';
var Character = /** @class */ (function () {
    function Character(game, config, terrian) {
        this.ySpeed = 0;
        this.canJump = true;
        this.game = game;
        this.config = config;
        this.terrian = terrian;
        this.keymaps = [
            { key: 'w', callback: this.handleUp.bind(this) },
            { key: 'a', callback: this.handleLeft.bind(this) },
            { key: 's', callback: this.handleDown.bind(this) },
            { key: 'd', callback: this.handleRight.bind(this) },
            { key: ' ', callback: this.handleJump.bind(this) },
        ];
    }
    Character.prototype.calcurateGravity = function () {
        var _this = this;
        this.game.camera.position.y = this.game.camera.position.y - this.ySpeed;
        this.ySpeed = this.ySpeed + GRAVITY;
        this.terrian.chunks.forEach(function (block) {
            if (isCollideCameraAndBlock(_this.game.camera, block) &&
                _this.game.camera.position.y <= block.position.y + BLOCK.SIZE / 2 &&
                _this.game.camera.position.y >= block.position.y - BLOCK.SIZE / 2) {
                _this.game.camera.position.y = block.position.y + BLOCK.SIZE / 2;
                _this.ySpeed = 0;
                _this.canJump = true;
            }
        });
    };
    /**
     * handle key event
     */
    Character.prototype.handleUp = function () {
        var _this = this;
        this.game.controls.moveForward(CAMERA.MOVING_SPEED);
        if (this.config.autoJump)
            return;
        this.terrian.chunks.forEach(function (block) {
            if (isCollideCameraAndBlock(_this.game.camera, block) &&
                _this.game.camera.position.y <= block.position.y - BLOCK.SIZE / 2) {
                _this.game.controls.moveForward(-1 * CAMERA.MOVING_SPEED);
            }
        });
    };
    Character.prototype.handleLeft = function () {
        var _this = this;
        this.game.controls.moveRight(-1 * CAMERA.MOVING_SPEED);
        if (this.config.autoJump)
            return;
        this.terrian.chunks.forEach(function (block) {
            if (isCollideCameraAndBlock(_this.game.camera, block) &&
                _this.game.camera.position.y === block.position.y - BLOCK.SIZE / 2) {
                _this.game.controls.moveRight(CAMERA.MOVING_SPEED);
            }
        });
    };
    Character.prototype.handleDown = function () {
        var _this = this;
        this.game.controls.moveForward(-1 * CAMERA.MOVING_SPEED);
        if (this.config.autoJump)
            return;
        this.terrian.chunks.forEach(function (block) {
            if (isCollideCameraAndBlock(_this.game.camera, block) &&
                _this.game.camera.position.y === block.position.y - BLOCK.SIZE / 2) {
                _this.game.controls.moveForward(CAMERA.MOVING_SPEED);
            }
        });
    };
    Character.prototype.handleRight = function () {
        var _this = this;
        this.game.controls.moveRight(CAMERA.MOVING_SPEED);
        if (this.config.autoJump)
            return;
        this.terrian.chunks.forEach(function (block) {
            if (isCollideCameraAndBlock(_this.game.camera, block) &&
                _this.game.camera.position.y === block.position.y - BLOCK.SIZE / 2) {
                _this.game.controls.moveRight(-1 * CAMERA.MOVING_SPEED);
            }
        });
    };
    Character.prototype.handleJump = function () {
        if (!this.canJump)
            return;
        this.canJump = false;
        this.ySpeed = -1 * CAMERA.JUMP_HEIGHT;
    };
    return Character;
}());
export { Character };
