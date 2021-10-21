import { Game } from './game';
import { Terrian } from './terrian';
import { Keyboard } from './keyboard';
import { Configure } from './configure';
import { Character } from './character';
var config = new Configure();
config.renderToggleAutoJump();
var game = new Game();
var terrian = new Terrian();
terrian.generate(0, 0);
game.addChunksToScene(terrian.chunks);
var character = new Character(game, config, terrian);
var keyboard = new Keyboard(character.keymaps);
game.loop(function () {
    keyboard.dispatch();
    character.calcurateGravity();
});
