import { Ending } from './scenes/Ending';
import { EndingRouter } from './scenes/EndingRouter';
import { Choice } from './scenes/Choice';
import { Intro } from './scenes/Intro';
import Phaser from 'phaser';
import { Preloader } from './scenes/Preloader';
import { Runner } from './scenes/Runner';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 1200 },
      debug: false,
    },
  },
  scene: [Preloader, Intro, Runner, Choice, EndingRouter, Ending],
};

const StartGame = (parent: string) => {
  return new Phaser.Game({ ...config, parent });
};

document.addEventListener('DOMContentLoaded', () => {
  StartGame('game-container');
});
