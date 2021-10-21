var Configure = /** @class */ (function () {
    function Configure() {
        this.autoJump = true;
    }
    Configure.prototype.renderToggleAutoJump = function () {
        var _this = this;
        var autoJumpButton = document.getElementById('auto-jump');
        autoJumpButton === null || autoJumpButton === void 0 ? void 0 : autoJumpButton.addEventListener('click', function () {
            _this.autoJump = !_this.autoJump;
            autoJumpButton.innerHTML = "AutoJump: " + (_this.autoJump ? 'On' : 'Off');
        });
    };
    return Configure;
}());
export { Configure };
