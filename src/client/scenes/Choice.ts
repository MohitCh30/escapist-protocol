import Phaser from 'phaser';
import { gameState, modifierForChoice, SCENARIOS, type ChoiceValue, type Scenario } from '../data';
import { scenarioIndexAt, dailyState } from '../daily';
import { rngStream } from '../../shared/daily';
import { addCrtOverlay, playSoundIfLoaded, typewriterEffect } from '../util';

const FLASH_COLORS: Record<ChoiceValue, number> = {
  1: 0x00ff00,
  0: 0xffff00,
  [-1]: 0xff0000,
};

const EMOTION_BY_VALUE: Record<ChoiceValue, string> = {
  1: 'happy',
  0: 'sad',
  [-1]: 'doomed',
};

export class Choice extends Phaser.Scene {
  private choiceMade = false;
  private choiceButtons: Phaser.GameObjects.Text[] = [];
  private slot = 0;
  private npcSprite?: Phaser.GameObjects.Image;

  constructor() {
    super('Choice');
  }

  init(data: { i: number }) {
    this.slot = data.i;
    this.choiceMade = false;
    this.choiceButtons = [];
  }

  private scenario(): Scenario | undefined {
    return SCENARIOS[scenarioIndexAt(this.slot)];
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const scenario = this.scenario();
    if (!scenario) return;

    const bg = this.add.image(width / 2, height / 2, 'background').setDisplaySize(width, height);
    bg.setTint(scenario.tint);
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);

    this.npcSprite = this.add.image(200, 400, `px-npc-${scenario.key}-scared`);
    this.npcSprite.setDisplaySize(120, 130);
    this.tweens.add({ targets: this.npcSprite, y: 394, duration: 900, yoyo: true, repeat: -1 });

    const dangerCircle = this.add.circle(200, 400, 120, 0xff0000, 0.1);
    this.tweens.add({
      targets: dangerCircle,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0.4,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const emergencyLight = this.add.circle(200, 300, 80, 0xff4444, 0.2);
    this.tweens.add({
      targets: emergencyLight,
      alpha: 0.6,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(width / 2, 60, scenario.sector, {
        font: 'bold 24px Arial',
        color: '#ff4444',
        align: 'center',
      })
      .setOrigin(0.5);

    const scenarioBox = this.add
      .text(width / 2, 190, '', {
        font: '28px Arial',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 900 },
        backgroundColor: 'rgba(0,0,0,0.95)',
        padding: { x: 30, y: 25 },
        stroke: '#ffffff',
        strokeThickness: 1,
      })
      .setOrigin(0.5);

    const dayKey = dailyState.info?.dayKey ?? new Date().toISOString().slice(0, 10);
    const variantPicker = rngStream(`${dayKey}:variant:${scenario.key}`);
    const variantIdx = Math.floor(variantPicker() * (scenario.variants.length + 1));
    const variantText =
      variantIdx > 0 ? (scenario.variants[variantIdx - 1] ?? scenario.text) : scenario.text;

    this.time.delayedCall(800, () => {
      typewriterEffect(
        this,
        scenarioBox,
        `${scenario.sector}\n\n${variantText}`,
        30,
        () => this.time.delayedCall(500, () => this.showChoices()),
      );
    });

    const score = gameState.score;
    this.add
      .text(width - 180, 50, `Morality: ${score}`, {
        font: '20px Arial',
        color: score >= 0 ? '#00ff00' : '#ff0000',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: { x: 15, y: 10 },
      })
      .setOrigin(0.5);

    addCrtOverlay(this);
  }

  showChoices() {
    const scenario = this.scenario();
    if (!scenario) return;
    scenario.choices.forEach((choice, index) => {
      const yPos = 420 + index * 85;

      const choiceBtn = this.add
        .text(this.scale.width / 2, yPos, choice.label, {
          font: '24px Arial',
          color: choice.color,
          backgroundColor: 'rgba(0,0,0,0.95)',
          padding: { x: 35, y: 18 },
          stroke: choice.color,
          strokeThickness: 2,
          align: 'center',
          wordWrap: { width: 1000 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0);

      this.tweens.add({
        targets: choiceBtn,
        alpha: 1,
        y: yPos - 10,
        duration: 600,
        delay: index * 200,
        ease: 'Back.easeOut',
      });

      choiceBtn.on('pointerover', () => {
        choiceBtn.setStyle({ color: '#000000', backgroundColor: choice.color });
      });

      choiceBtn.on('pointerout', () => {
        choiceBtn.setStyle({ color: choice.color, backgroundColor: 'rgba(0,0,0,0.95)' });
      });

      choiceBtn.on('pointerdown', () => {
        if (this.choiceMade) return;
        this.choiceMade = true;
        this.choiceButtons.forEach((btn) => btn.disableInteractive());

        playSoundIfLoaded(this, 'click');

        const TIME_PENALTY_BY_VALUE: Record<ChoiceValue, number> = { 1: 3000, 0: 1000, [-1]: 0 };
        gameState.penaltyMs += TIME_PENALTY_BY_VALUE[choice.value];
        gameState.score += choice.value;
        gameState.nextRunModifier = modifierForChoice(choice.value, scenario.key);
        gameState.choices.push({
          npc: scenario.key,
          label: choice.label,
          value: choice.value,
        });

        const flashColor = FLASH_COLORS[choice.value];
        this.cameras.main.flash(400, (flashColor >> 16) & 255, (flashColor >> 8) & 255, flashColor & 255);

        if (this.npcSprite) {
          this.npcSprite.setTexture(`px-npc-${scenario.key}-${EMOTION_BY_VALUE[choice.value]}`);
        }
        if (this.npcSprite && choice.value === -1) {
          this.tweens.add({ targets: this.npcSprite, alpha: 0.35, angle: -4, duration: 500 });
        } else if (this.npcSprite && choice.value === 1) {
          this.tweens.add({ targets: this.npcSprite, scaleX: '+=0.08', scaleY: '+=0.08', duration: 300, yoyo: true });
        }

        this.add
          .text(this.scale.width / 2, 620, choice.feedback, {
            font: '22px Arial',
            color: choice.color,
            backgroundColor: 'rgba(0,0,0,0.9)',
            padding: { x: 20, y: 10 },
            align: 'center',
            wordWrap: { width: 900 },
          })
          .setOrigin(0.5);

        this.time.delayedCall(1500, () => {
          this.cameras.main.fadeOut(500, 0, 0, 0);
          this.time.delayedCall(500, () => {
            const next = this.slot + 1;
            if (next < SCENARIOS.length) {
              this.scene.start('Runner', { i: next });
            } else {
              this.scene.start('EndingRouter');
            }
          });
        });
      });

      this.choiceButtons.push(choiceBtn);
    });
  }
}
