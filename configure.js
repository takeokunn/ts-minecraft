import { CAMERA, CONSTANT } from '@src/constant';
var Configure = /** @class */ (function () {
    function Configure() {
        this.autoJump = CONSTANT.INITIAL_AUTO_JUMP;
        this.isShowLineSegment = CAMERA.INITIALIZE.IS_SHOW_LINESEGMENT;
        this.cameraPerspectiveDistance = CAMERA.PERSPECTIVE.NEAR;
    }
    Configure.prototype.render = function (params) {
        this.renderToggleAutoJump();
        this.renderChangeCameraDistance(params.handleClickPerspective);
        this.renderLineSegment(params.handleClickLineSegment);
    };
    Configure.prototype.renderToggleAutoJump = function () {
        var _this = this;
        var button = document.getElementById('auto-jump');
        button === null || button === void 0 ? void 0 : button.addEventListener('click', function () {
            _this.autoJump = !_this.autoJump;
            button.innerHTML = "AutoJump: " + (_this.autoJump ? 'On' : 'Off');
        });
    };
    Configure.prototype.renderChangeCameraDistance = function (handleClickPerspective) {
        var _this = this;
        var button = document.getElementById('camera-perspective');
        button === null || button === void 0 ? void 0 : button.addEventListener('click', function () {
            switch (_this.cameraPerspectiveDistance) {
                case CAMERA.PERSPECTIVE.NEAR:
                    _this.cameraPerspectiveDistance = CAMERA.PERSPECTIVE.MIDDLE;
                    button.innerHTML = "Perspective: Middle";
                    break;
                case CAMERA.PERSPECTIVE.MIDDLE:
                    _this.cameraPerspectiveDistance = CAMERA.PERSPECTIVE.FAR;
                    button.innerHTML = "Perspective: Far";
                    break;
                case CAMERA.PERSPECTIVE.FAR:
                    _this.cameraPerspectiveDistance = CAMERA.PERSPECTIVE.NEAR;
                    button.innerHTML = "Perspective: Near";
                    break;
            }
            handleClickPerspective(_this.cameraPerspectiveDistance);
        });
    };
    Configure.prototype.renderLineSegment = function (handleClickLineSegment) {
        var _this = this;
        var button = document.getElementById('line-segment');
        button === null || button === void 0 ? void 0 : button.addEventListener('click', function () {
            _this.isShowLineSegment = !_this.isShowLineSegment;
            handleClickLineSegment(_this.isShowLineSegment);
            button.innerHTML = "LineSegment: " + (_this.isShowLineSegment ? 'Show' : 'Hide');
        });
    };
    return Configure;
}());
export { Configure };
