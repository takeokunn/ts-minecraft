import { Game } from './game'
import { Terrian } from './terrian'
import { Keyboard } from './keyboard'
import { Configure } from './configure'
import { Character } from './character'

const config = new Configure()
config.renderToggleAutoJump()

const game = new Game()
const terrian = new Terrian()
terrian.generate(0, 0)
game.addChunksToScene(terrian.chunks)

const character = new Character(game, config, terrian)
const keyboard = new Keyboard(character.keymaps)

const update = () => {
  keyboard.dispatch()
  character.calcurateGravity()
}

game.loop(update)
