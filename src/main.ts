import { Game } from '@src/game'
import { Terrian } from '@src/terrian'
import { Keyboard } from '@src/keyboard'
import { Configure } from '@src/configure'
import { Character } from '@src/character'

const terrian = new Terrian()
terrian.generate()

const config = new Configure()
const game = new Game()
config.render({
  handleClickPerspective: (far: number) => game.camera.setFar(far),
  handleClickLineSegment: (isShow: boolean) =>
    isShow ? game.addLineSegmentBlock(terrian.getChunkBlocks()) : game.removeLineSegmentBlock(),
})
game.addChunksToScene(terrian.getChunkBlocks())

const character = new Character(game, config, terrian)
const keyboard = new Keyboard(character.keymaps)

game.loop(() => {
  keyboard.dispatch()
  character.calcurateGravity()
})
