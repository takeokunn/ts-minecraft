import { Game } from '@src/game';
import { Terrian } from '@src/terrian';
import { Keyboard } from '@src/keyboard';
import { Configure } from '@src/configure';
import { Character } from '@src/character';
var config = new Configure();
config.renderToggleAutoJump();
var terrian = new Terrian();
terrian.generate(0, 0);
var game = new Game();
game.addChunksToScene(terrian.chunks, config.isDisplayLineSegment);
var character = new Character(game, config, terrian);
var keyboard = new Keyboard(character.keymaps);
game.loop(function () {
    keyboard.dispatch();
    character.calcurateGravity();
});
