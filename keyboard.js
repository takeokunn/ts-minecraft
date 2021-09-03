var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var Keyboard = /** @class */ (function () {
    function Keyboard(keymaps) {
        this.keys = ["fdsafda"];
        this.keys = [];
        this.keymaps = keymaps;
    }
    Keyboard.prototype.handleKeyDown = function (e) {
        this.keys = __spreadArray(__spreadArray([], this.keys, true), [e.key], false);
    };
    Keyboard.prototype.handleKeyUp = function (e) {
        this.keys = this.keys.filter(function (key) { return key !== e.key; });
    };
    Keyboard.prototype.dispatch = function () {
        var _this = this;
        this.keymaps.forEach(function (keymap) {
            if (_this.keys.includes(keymap.key))
                keymap.callback();
        });
    };
    return Keyboard;
}());
export default Keyboard;
