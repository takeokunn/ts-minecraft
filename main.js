import { Game } from '@src/game';
import { Terrian } from '@src/terrian';
import { Keyboard } from '@src/keyboard';
import { Configure } from '@src/configure';
import { Character } from '@src/character';
var terrian = new Terrian();
terrian.generate(0, 0);
var config = new Configure();
var game = new Game();
config.render({
    handleClickPerspective: function (far) { return game.setCameraFar(far); },
    handleClickLineSegment: function (isShow) {
        return isShow ? game.addLineSegmentBlock(terrian.chunks) : game.removeLineSegmentBlock();
    },
});
game.addChunksToScene(terrian.chunks);
var character = new Character(game, config, terrian);
var keyboard = new Keyboard(character.keymaps);
game.loop(function () {
    keyboard.dispatch();
    character.calcurateGravity();
});
