import type Phaser from 'phaser';

export function playSoundIfLoaded(scene: Phaser.Scene, key: string, config?: Phaser.Types.Sound.SoundConfig): void {
  if (!scene.cache.audio.exists(key)) return;
  try {
    scene.sound.add(key, config).play();
  } catch {
    try {
      scene.sound.play(key, config);
    } catch {
      return;
    }
  }
}

export function addCrtOverlay(scene: Phaser.Scene): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const g = scene.add.graphics().setScrollFactor(0).setDepth(40).setAlpha(0.05);
  g.fillStyle(0x000000, 1);
  for (let y = 0; y < h; y += 4) {
    g.fillRect(0, y + 3, w, 1);
  }
  const v = scene.add.graphics().setScrollFactor(0).setDepth(41);
  v.lineStyle(8, 0x000000, 0.5);
  v.strokeRect(4, 4, w - 8, h - 8);
}

export function burstSquares(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count = 8,
  speed = 220,
): void {
  const frand = (min: number, max: number) => min + Math.random() * (max - min);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + frand(-0.2, 0.2);
    const vel = speed * frand(0.5, 1.1);
    const sq = scene.add.rectangle(x, y, 6, 6, color).setDepth(15);
    scene.tweens.add({
      targets: sq,
      x: x + Math.cos(angle) * vel,
      y: y + Math.sin(angle) * vel * 0.7 + 40,
      alpha: 0,
      scale: 0.2,
      duration: frand(300, 600),
      ease: 'Power2',
      onComplete: () => sq.destroy(),
    });
  }
}

export function typewriterEffect(
  scene: Phaser.Scene,
  textObject: Phaser.GameObjects.Text,
  fullText: string,
  speed = 40,
  onComplete?: () => void,
): void {
  let index = 0;
  let skipped = false;

  const skipHandler = (): void => {
    skipped = true;
    textObject.text = fullText;
    scene.input.off('pointerdown', skipHandler);
    if (onComplete) onComplete();
  };
  scene.input.on('pointerdown', skipHandler);

  const type = (): void => {
    if (skipped) return;
    if (index < fullText.length) {
      textObject.text += fullText[index];
      index += 1;
      scene.time.delayedCall(speed, type);
    } else {
      scene.input.off('pointerdown', skipHandler);
      if (onComplete) onComplete();
    }
  };
  type();
}
