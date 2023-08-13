import { Game } from '@src/game'
import { Terrian } from '@src/terrian'
import { createStats } from '@src/utils'
import { Keyboard } from '@src/keyboard'
import { Configure } from '@src/configure'
import { Character } from '@src/character'

const terrian = new Terrian()
terrian.initialize()

const config = new Configure()
const game = new Game()
config.render({
  handleClickPerspective: (far: number) => game.controls.setFar(far),
  handleClickLineSegment: (isShow: boolean) => (isShow ? game.addLineSegmentBlock(terrian.getChunkBlocks()) : game.removeLineSegmentBlock()),
})
game.addChunksToScene(terrian.chunks, config.isShowLineSegment)

const stats = createStats()
const character = new Character(game, config, terrian)
const keyboard = new Keyboard(character.keymaps)

game.loop(
  () => stats.begin(),
  () => {
    keyboard.dispatch()
    character.calcurateGravity()
    terrian.generateNewChunk(game.controls.perspective.position.x, game.controls.perspective.position.z)
    game.addChunksToScene(terrian.chunks, config.isShowLineSegment)
    game.renderRaycastPlane()
  },
  () => stats.end(),
)
