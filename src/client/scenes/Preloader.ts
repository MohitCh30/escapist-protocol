import Phaser from 'phaser';
import { generateSprites } from '../art/sprites';
import { fetchDailyInit } from '../daily';

export class Preloader extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    this.add
      .text(width / 2, height / 2 - 60, 'ESCAPE PROTOCOL: DAILY LOCKDOWN', {
        font: 'bold 28px Arial',
        color: '#ff0000',
      })
      .setOrigin(0.5);

    this.add.rectangle(width / 2, height / 2, 468, 32).setStrokeStyle(1, 0xffffff);

    const bar = this.add.rectangle(width / 2 - 230, height / 2, 4, 28, 0xffffff);

    this.load.on('progress', (progress: number) => {
      bar.width = 4 + 460 * progress;
    });

    this.load.setPath('../assets');

    this.load.image('background', 'background.webp');
    this.load.image('npcPrisha', 'npc/npcPrisha.png');
    this.load.image('npcAdvik', 'npc/npcAdvik.png');
    this.load.image('npcTanya', 'npc/npcTanya.png');
    this.load.image('npcChaps', 'npc/npcChaps.png');
    this.load.audio('alarm', ['sfx/alarm.mp3']);
    this.load.audio('click', ['sfx/click.mp3']);
    this.load.audio('music', ['sfx/music.mp3']);
  }

  create() {
    generateSprites(this);
    const width = this.scale.width;
    const height = this.scale.height;
    const status = this.add
      .text(width / 2, height / 2 + 40, 'CONNECTING TO LOCKDOWN SERVER...', {
        font: '16px Arial',
        color: '#888888',
      })
      .setOrigin(0.5);
    void fetchDailyInit().then(() => {
      status.destroy();
      const params = new URLSearchParams(location.search);
      const debugScene = params.get('scene') ?? '';
      const slot = Number(params.get('slot') ?? '0');
      if (debugScene === 'runner') {
        this.scene.start('Runner', { i: slot });
      } else if (debugScene === 'choice') {
        this.scene.start('Choice', { i: slot });
      } else if (debugScene === 'ending') {
        this.scene.start('EndingRouter');
      } else {
        this.scene.start('Intro');
      }
    });
  }
}
