import Phaser from 'phaser';
import { resetGameState } from '../data';
import { dailyState, fetchLeaderboard } from '../daily';
import { addCrtOverlay, playSoundIfLoaded, typewriterEffect } from '../util';
import { formatMs } from '../data';

export class Intro extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create() {
    resetGameState();

    const width = this.scale.width;
    const height = this.scale.height;

    this.add.image(width / 2, height / 2, 'background').setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.3);

    const title1 = this.add
      .text(width / 2, 180, 'ESCAPE PROTOCOL:', {
        font: 'bold 52px Arial',
        color: '#ff0000',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const title2 = this.add
      .text(width / 2, 240, 'DAILY LOCKDOWN', {
        font: 'bold 52px Arial',
        color: '#ffffff',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({ targets: title1, alpha: 1, duration: 1000, ease: 'Power2' });
    this.tweens.add({ targets: title2, alpha: 1, duration: 1000, delay: 500, ease: 'Power2' });

    const info = dailyState.info;
    if (info) {
      const line2 = `DAY ${info.dayNumber} · ${info.dayKey}`;
      this.add
        .text(width / 2, 140, line2, {
          font: 'bold 22px Arial',
          color: '#00ccff',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      if (info.streak >= 2) {
        this.add
          .text(width / 2, 290, `Streak: ${info.streak} days`, {
            font: '20px Arial',
            color: '#ffd700',
            align: 'center',
          })
          .setOrigin(0.5);
      }
      if (info.alreadyPlayed) {
        this.add
          .text(width / 2, height - 60, 'Protocol already completed today — replay does not affect the board.', {
            font: '16px Arial',
            color: '#aaaaaa',
            align: 'center',
          })
          .setOrigin(0.5);
      }
    } else {
      this.add
        .text(width / 2, 140, 'OFFLINE MODE', {
          font: 'bold 22px Arial',
          color: '#888888',
          align: 'center',
        })
        .setOrigin(0.5);
    }

    const subtitle = this.add
      .text(width / 2, 320, '', {
        font: '26px Arial',
        color: '#ffffff',
        align: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: { x: 25, y: 20 },
      })
      .setOrigin(0.5);

    const subtitleText =
      'The AI lockdown has begun.\nYour classmates are trapped.\nEvery choice determines their fate.';
    this.time.delayedCall(1500, () => typewriterEffect(this, subtitle, subtitleText, 50));

    const beginBtn = this.add
      .text(width / 2, 500, '\u25ba BEGIN PROTOCOL', {
        font: 'bold 36px Arial',
        color: '#00ff00',
        backgroundColor: 'rgba(0,0,0,0.9)',
        padding: { x: 40, y: 20 },
        stroke: '#00ff00',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: beginBtn,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    beginBtn.on('pointerover', () =>
      beginBtn.setStyle({ color: '#000000', backgroundColor: 'rgba(0,255,0,0.9)' }),
    );
    beginBtn.on('pointerout', () =>
      beginBtn.setStyle({ color: '#00ff00', backgroundColor: 'rgba(0,0,0,0.9)' }),
    );
    beginBtn.on('pointerdown', () => {
      playSoundIfLoaded(this, 'click');
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => this.scene.start('Runner', { i: 0 }));
    });

    try {
      this.sound.stopAll();
    } catch {
      // sound manager may be locked before first gesture
    }
    playSoundIfLoaded(this, 'music', { loop: true, volume: 0.3 });
    playSoundIfLoaded(this, 'alarm', { loop: true, volume: 0.1 });

    void fetchLeaderboard().then((board) => {
      if (!board || !this.scene.isActive('Intro')) return;
      const lines: string[] = [`TOP ESCAPES TODAY — ${board.playersToday} runners`, ''];
      board.top.slice(0, 5).forEach((e) => {
        const medal = e.rank === 1 ? '\u{1F947}' : e.rank === 2 ? '\u{1F948}' : e.rank === 3 ? '\u{1F949}' : `${e.rank}.`;
        lines.push(`${medal} ${e.username} — ${formatMs(e.timeMs)} · ${e.saved}/4 saved`);
      });
      if (board.top.length === 0) lines.push('No escapes yet today. Be the first.');
      this.add
        .text(this.scale.width - 30, 160, lines.join('\n'), {
          font: '16px Arial',
          color: '#00ccff',
          align: 'left',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: { x: 18, y: 12 },
        })
        .setOrigin(1, 0);
    });

    addCrtOverlay(this);
    this.cameras.main.fadeIn(1000, 0, 0, 0);
  }
}
