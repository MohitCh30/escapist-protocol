import Phaser from 'phaser';
import { ENDINGS, formatMs, gameState, totalRunMs, type EndingId } from '../data';
import { dailyState, shareResult, submitDailyResult } from '../daily';
import type { DailyResult } from '../../shared/api';
import { addCrtOverlay, playSoundIfLoaded, typewriterEffect } from '../util';

export type EndingSceneData = { id: EndingId };

export class Ending extends Phaser.Scene {
  private endingId: EndingId = 'neutral';

  constructor() {
    super('Ending');
  }

  init(data: EndingSceneData) {
    this.endingId = data.id;
    this.statsRetries = 0;
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const ending = ENDINGS[this.endingId];

    const bg = this.add.image(width / 2, height / 2, 'background').setDisplaySize(width, height);
    bg.setTint(ending.tint);
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);

    const title = this.add
      .text(width / 2, 90, ending.title, {
        font: 'bold 44px Arial',
        color: '#ffffff',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: title,
      alpha: 1,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 1500,
      ease: 'Power2',
    });

    const score = gameState.score;
    const scoreColor = score >= 3 ? '#00ff00' : score <= -2 ? '#ff0000' : '#ffff00';
    this.add
      .text(width / 2, 160, `Final Judgment: ${ending.label} (${score})`, {
        font: '26px Arial',
        color: scoreColor,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    const savedCount = gameState.choices.filter((c) => c.value > 0).length;
    const savedColor = savedCount >= 3 ? '#00ff00' : savedCount >= 2 ? '#ffff00' : '#ff6666';
    this.add
      .text(width / 2, 200, `You Saved: ${savedCount}/4 classmates`, {
        font: 'bold 22px Arial',
        color: savedColor,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 238, `Escape Time: ${formatMs(totalRunMs())}  (penalties +${formatMs(gameState.penaltyMs)})`, {
        font: 'bold 24px Arial',
        color: '#00ffcc',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    const messageText = this.add
      .text(width / 2, 330, '', {
        font: '20px Arial',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 920 },
        backgroundColor: 'rgba(0,0,0,0.95)',
        padding: { x: 25, y: 12 },
        stroke: '#ffffff',
        strokeThickness: 1,
      })
      .setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      typewriterEffect(this, messageText, ending.message, 40, () => {
        this.time.delayedCall(1000, () => this.showRecapAndRestart());
      });
    });

    this.cameras.main.fadeIn(1000, 0, 0, 0);
    addCrtOverlay(this);
    this.submitResult();
  }

  private submitResult() {
    const result: DailyResult = {
      endingId: this.endingId,
      score: gameState.score,
      saved: gameState.choices.filter((c) => c.value > 0).length,
      timeMs: totalRunMs(),
      choices: gameState.choices.map((c) => ({ npc: c.npc, label: c.label, value: c.value })),
    };
    void submitDailyResult(result);
  }

  showRecapAndRestart() {
    const width = this.scale.width;
    const choices = gameState.choices;

    if (choices.length > 0) {
      const spacing = Math.min(150, width / (choices.length + 1));
      const startX = width / 2 - ((choices.length - 1) * spacing) / 2;
      choices.forEach((c, i) => {
        const emotion = c.value > 0 ? 'happy' : c.value < 0 ? 'doomed' : 'sad';
        const cx = startX + i * spacing;
        const face = this.add.image(cx, 490, `px-npc-${c.npc}-${emotion}`);
        face.setDisplaySize(52, 56);
        this.add
          .text(cx, 536, c.npc.charAt(0).toUpperCase() + c.npc.slice(1), {
            font: 'bold 13px Arial',
            color: c.value > 0 ? '#00ff88' : c.value < 0 ? '#ff5555' : '#ffcc44',
            align: 'center',
          })
          .setOrigin(0.5);
        const action = c.label.split(' - ')[0];
        this.add
          .text(cx, 556, action ?? '', {
            font: '11px Arial',
            color: '#aaaaaa',
            align: 'center',
          })
          .setOrigin(0.5);
      });
    }

    this.renderStatsPanel(width);

    this.time.delayedCall(800, () => {
      this.buildButtons(width, 660);
    });
  }

  private statsRetries = 0;

  private renderStatsPanel(width: number) {
    const daily = dailyState.submit;
    if (!daily) {
      if (!dailyState.offline && this.statsRetries < 3) {
        this.statsRetries += 1;
        this.time.delayedCall(1500, () => this.renderStatsPanel(width));
      } else {
        this.add
          .text(980, 500, dailyState.offline ? 'OFFLINE\nLive stats unavailable' : 'Stats unavailable', {
            font: '16px Arial',
            color: '#888888',
            align: 'left',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: { x: 16, y: 10 },
          })
          .setOrigin(0.5);
      }
      return;
    }

    const agg = daily.aggregate;
    const lines: string[] = [
      `TODAY — DAY ${daily.dayNumber}`,
      `${agg.playersToday} players today`,
      `Your rank: #${daily.rank}`,
      dailyState.info ? `Streak: ${dailyState.submit?.streak ?? dailyState.info.streak} days` : null,
      '',
      ...agg.npcBreakdown.map((n) => {
        const total = n.rescue + n.neutral + n.sacrifice;
        const pct = total > 0 ? Math.round((n.rescue / total) * 100) : 0;
        const name = n.npc.charAt(0).toUpperCase() + n.npc.slice(1);
        return `Rescued: ${name} ${pct}%`;
      }),
    ].filter((l): l is string => l !== null);

    this.add
      .text(980, 500, lines.join('\n'), {
        font: '17px Arial',
        color: '#00ccff',
        align: 'left',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5);
  }

  private buildButtons(width: number, y: number) {
    const shareBtn = this.add
      .text(width / 2 - 180, y, '\u25ba SHARE RESULT', {
        font: 'bold 28px Arial',
        color: '#00ccff',
        backgroundColor: 'rgba(0,0,0,0.95)',
        padding: { x: 30, y: 16 },
        stroke: '#00ccff',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);

    const restartBtn = this.add
      .text(width / 2 + 180, y, '\u25ba REPLAY PROTOCOL', {
        font: 'bold 28px Arial',
        color: '#00ff00',
        backgroundColor: 'rgba(0,0,0,0.95)',
        padding: { x: 30, y: 16 },
        stroke: '#00ff00',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);

    this.tweens.add({ targets: [shareBtn, restartBtn], alpha: 1, duration: 800, ease: 'Back.easeOut' });

    this.tweens.add({
      targets: [shareBtn, restartBtn],
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    shareBtn.on('pointerdown', async () => {
      playSoundIfLoaded(this, 'click');
      shareBtn.disableInteractive().setAlpha(0.6);
      const text = this.buildShareText();
      const posted = await shareResult(text);
      shareBtn.setInteractive({ useHandCursor: true }).setAlpha(1);
      const note = this.add
        .text(width / 2, y + 48, '', { font: '16px Arial', color: '#ffffff' })
        .setOrigin(0.5);
      if (posted) {
        note.setText('Result posted to the comment thread! Check the thread.');
        note.setColor('#00ff00');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        note.setText('Sharing unavailable — result copied to clipboard instead.');
        note.setColor('#ffff00');
      } catch {
        note.setText('Sharing unavailable.');
        note.setColor('#ff6666');
      }
    });

    restartBtn.on('pointerdown', () => {
      playSoundIfLoaded(this, 'click');
      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.time.delayedCall(800, () => this.scene.start('Intro'));
    });
  }

  buildShareText(): string {
    const ending = ENDINGS[this.endingId];
    const savedCount = gameState.choices.filter((c) => c.value > 0).length;
    const day = dailyState.info?.dayNumber ?? dailyState.submit?.dayNumber;
    const lines = gameState.choices.map((c) => {
      const emoji = c.value > 0 ? '\u2705' : c.value < 0 ? '\u274c' : '\u26a0\ufe0f';
      return `${emoji} ${c.npc.charAt(0).toUpperCase()}${c.npc.slice(1)}`;
    });
    return [
      `ESCAPE PROTOCOL: DAILY LOCKDOWN${day ? ` — DAY ${day}` : ''}`,
      `Ending: ${ending.title}`,
      `Morality: ${gameState.score} | Saved: ${savedCount}/4`,
      ...lines,
    ].join('\n');
  }
}
