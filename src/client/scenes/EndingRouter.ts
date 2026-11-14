import Phaser from 'phaser';
import { gameState, resolveEndingId } from '../data';

export class EndingRouter extends Phaser.Scene {
  constructor() {
    super('EndingRouter');
  }

  create() {
    this.scene.start('Ending', { id: resolveEndingId(gameState.score) });
  }
}
