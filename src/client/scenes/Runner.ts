import Phaser from 'phaser';
import { gameState, formatMs, totalRunMs, SCENARIOS } from '../data';
import { dailyState, scenarioIndexAt } from '../daily';
import { buildSegment, FLOOR_Y, type DroneDef, type Rect } from '../runner/level';
import { addCrtOverlay, burstSquares, playSoundIfLoaded } from '../util';
import { markTutorialDone, shouldShowTutorial, SECTOR_ONE_HINTS } from '../tutorial';

const RUN_SPEED = 260;
const JUMP_VELOCITY = -600;
const SPOT_PENALTY_MS = 3000;
const FALL_PENALTY_MS = 2000;
const SUBJUGATE_PENALTY_MS = 10000;
const ALERT_RATE = 65;
const ALERT_DECAY = 28;
const MAX_WOUNDS = 2;

type DroneState = {
  def: DroneDef;
  dir: number;
  sprite: Phaser.GameObjects.Image;
  cone: Phaser.GameObjects.Triangle;
  frame: number;
};

export class Runner extends Phaser.Scene {
  private slot = 0;
  private elapsed = 0;
  private crouching = false;
  private moving = false;
  private cooldown = 0;
  private finished = false;
  private hidePointerId: number | null = null;
  private movePointerId: number | null = null;
  private alert = 0;
  private wounds = 0;
  private runSpeed = RUN_SPEED;
  private alertMult = 1;
  private modifierLabel = '';

  private player?: Phaser.Physics.Arcade.Sprite;
  private animAcc = 0;
  private droneAcc = 0;
  private drones: DroneState[] = [];
  private timeText?: Phaser.GameObjects.Text;
  private penaltyText?: Phaser.GameObjects.Text;
  private alertBarBg?: Phaser.GameObjects.Rectangle;
  private alertBar?: Phaser.GameObjects.Rectangle;
  private woundText?: Phaser.GameObjects.Text;

  constructor() {
    super('Runner');
  }

  init(data: { i: number }) {
    this.slot = data.i;
    this.elapsed = 0;
    this.crouching = false;
    this.cooldown = 0;
    this.finished = false;
    this.drones = [];
    this.hidePointerId = null;
    this.movePointerId = null;
    this.moving = false;
    this.alert = 0;
    this.wounds = 0;
    this.modifierLabel = gameState.nextRunModifier.label;
    this.runSpeed = RUN_SPEED * gameState.nextRunModifier.speedMult;
    this.alertMult = gameState.nextRunModifier.alertMult;
    gameState.nextRunModifier = { speedMult: 1, alertMult: 1, label: '' };
  }

  create() {
    const dayKey = dailyState.info?.dayKey ?? new Date().toISOString().slice(0, 10);
    const scenario = SCENARIOS[scenarioIndexAt(this.slot)];
    if (!scenario) return;
    const level = buildSegment(dayKey, this.slot);

    this.makeTextures();

    this.physics.world.setBounds(0, 0, level.length, 1000);
    this.cameras.main.setBounds(0, 0, level.length, 720);
    this.cameras.main.setBackgroundColor(0x060812);

    this.add
      .image(level.length / 2, 260, 'background')
      .setDisplaySize(level.length, 520)
      .setAlpha(0.3)
      .setDepth(-2);

    const solid = this.physics.add.staticGroup();
    for (const f of level.floors) this.addFloorSegment(solid, f);
    for (const p of level.pillars) this.addSolidRect(solid, p, 0x1c2537);
    for (const p of level.platforms) this.addSolidRect(solid, p, 0x3d4a63);

    const sortedFloors = [...level.floors].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sortedFloors.length - 1; i++) {
      const cur = sortedFloors[i];
      const nxt = sortedFloors[i + 1];
      if (!cur || !nxt) continue;
      const gapX = cur.x + cur.w;
      const gapW = nxt.x - gapX;
      if (gapW < 40) continue;

      const glow = this.add.rectangle(gapX + gapW / 2, 668, gapW, 60, 0xff2200, 0.55).setDepth(-1);
      this.tweens.add({ targets: glow, alpha: 0.25, duration: 400, yoyo: true, repeat: -1 });

      this.add.rectangle(gapX - 5, FLOOR_Y + 8, 10, 16, 0xffcc00);
      this.add.rectangle(nxt.x + 5, FLOOR_Y + 8, 10, 16, 0xffcc00);

      const warn = this.add
        .text(gapX - 90, FLOOR_Y - 110, '\u25b2', { font: '22px Arial', color: '#ffcc00' })
        .setOrigin(0.5);
      this.tweens.add({ targets: warn, y: FLOOR_Y - 92, duration: 400, yoyo: true, repeat: -1 });
    }

    this.player = this.physics.add.sprite(80, FLOOR_Y - 60, 'px-player-stand');
    this.player.setDisplaySize(34, 42);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, solid);
    this.cameras.main.startFollow(this.player, false, 0.12, 0);

    for (const hz of level.hazards) {
      const panel = this.add
        .tileSprite(hz.x + hz.w / 2, hz.y + hz.h / 2, hz.w, hz.h, 'px-hazard')
        .setTileScale(3, 3);
      this.physics.add.existing(panel, true);
      this.tweens.add({ targets: panel, alpha: 0.6, duration: 450, yoyo: true, repeat: -1 });
      this.physics.add.overlap(this.player, panel, this.onHazard, undefined, this);
    }

    for (const def of level.drones) this.spawnDrone(def);

    const npc = this.physics.add.sprite(level.npcX, FLOOR_Y - 58, `px-npc-${scenario.key}-scared`);
    npc.setDisplaySize(46, 50);
    npc.setImmovable(true);
    if (npc.body instanceof Phaser.Physics.Arcade.Body) npc.body.setAllowGravity(false);
    this.physics.add.overlap(this.player, npc, this.onReachNpc, undefined, this);
    const marker = this.add
      .text(level.npcX, FLOOR_Y - 150, '\u25bc', { font: 'bold 28px Arial', color: '#00ff88' })
      .setOrigin(0.5);
    this.tweens.add({ targets: marker, y: FLOOR_Y - 128, duration: 500, yoyo: true, repeat: -1 });

    const sector = this.add
      .text(level.length / 2, 110, scenario.sector, {
        font: 'bold 30px Arial',
        color: '#ff4444',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.time.delayedCall(3200, () => {
      this.tweens.add({ targets: sector, alpha: 0, duration: 800, onComplete: () => sector.destroy() });
    });

    this.alertBarBg = this.add.rectangle(0, 0, 60, 10, 0x000000, 0.7).setDepth(8).setVisible(false);
    this.alertBar = this.add.rectangle(0, 0, 54, 6, 0x00ccff).setDepth(9).setVisible(false);
    this.woundText = this.add
      .text(1260, 46, 'INTEGRITY \u25a0\u25a0', { font: 'bold 18px Arial', color: '#a8b400' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(10);
    if (this.modifierLabel) {
      this.add
        .text(20, 80, this.modifierLabel, { font: '16px Arial', color: '#ffd700' })
        .setScrollFactor(0)
        .setDepth(10);
    }

    this.timeText = this.add
      .text(20, 16, '0:00.0', { font: 'bold 26px Arial', color: '#00ffcc' })
      .setScrollFactor(0)
      .setDepth(10);
    this.penaltyText = this.add
      .text(20, 48, '', { font: '16px Arial', color: '#ffaa00' })
      .setScrollFactor(0)
      .setDepth(10);
    const mkPanel = (cx: number, w: number, stroke: number, label: string, color: string) => {
      this.add
        .rectangle(cx, this.scale.height - 60, w, 56, 0x000000, 0.55)
        .setScrollFactor(0)
        .setDepth(9)
        .setStrokeStyle(2, stroke);
      this.add
        .text(cx, this.scale.height - 60, label, {
          font: 'bold 17px Arial',
          color,
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(10);
    };
    mkPanel(this.scale.width * 0.15, 300, 0x4488ff, 'HOLD = HIDE / STOP\n(↓ / S)', '#77aaff');
    mkPanel(this.scale.width * 0.475, 300, 0x00ffcc, 'TAP = JUMP\n(↑ / SPACE)', '#00ffcc');
    mkPanel(this.scale.width * 0.825, 300, 0xffaa33, 'HOLD = RUN\n(→ / D)', '#ffaa33');

    if (this.slot === 0 && shouldShowTutorial()) {
      for (const hint of SECTOR_ONE_HINTS) {
        this.add
          .text(hint.x, FLOOR_Y - 210, `${hint.icon} ${hint.text}`, {
            font: 'bold 14px Arial',
            color: hint.color,
            align: 'center',
            backgroundColor: 'rgba(0,0,0,0.75)',
            padding: { x: 10, y: 6 },
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5);
      }
      this.add
        .text(160, FLOOR_Y - 220, 'FIRST DAY — TUTORIAL SIGNS AHEAD', {
          font: 'bold 13px Arial',
          color: '#ffffff',
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0, 0.5);
    }

    this.input.addPointer(2);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.downElement.tagName !== 'CANVAS') return;
      const pct = pointer.x / this.scale.width;
      if (pct < 0.3) {
        if (this.hidePointerId === null) {
          this.hidePointerId = pointer.id;
          this.setCrouch(true);
        }
      } else if (pct < 0.65) {
        this.tryJump();
      } else if (this.movePointerId === null) {
        this.movePointerId = pointer.id;
        this.moving = true;
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.hidePointerId !== null && pointer.id === this.hidePointerId) {
        this.hidePointerId = null;
        this.setCrouch(false);
      }
      if (this.movePointerId !== null && pointer.id === this.movePointerId) {
        this.movePointerId = null;
        this.moving = false;
      }
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.tryJump());
    kb?.on('keydown-UP', () => this.tryJump());
    kb?.on('keydown-W', () => this.tryJump());
    kb?.on('keydown-RIGHT', () => { this.moving = true; });
    kb?.on('keyup-RIGHT', () => { this.moving = false; });
    kb?.on('keydown-D', () => { this.moving = true; });
    kb?.on('keyup-D', () => { this.moving = false; });
    kb?.on('keydown-SHIFT', () => this.setCrouch(true));
    kb?.on('keyup-SHIFT', () => this.setCrouch(false));
    kb?.on('keydown-DOWN', () => this.setCrouch(true));
    kb?.on('keyup-DOWN', () => this.setCrouch(false));
    kb?.on('keydown-S', () => this.setCrouch(true));
    kb?.on('keyup-S', () => this.setCrouch(false));

    addCrtOverlay(this);
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  override update(_time: number, delta: number) {
    if (!this.player || this.finished) return;
    this.elapsed += delta;
    if (this.cooldown > 0) this.cooldown -= delta;

    const body = this.playerBody();
    if (!body) return;
    const advancing = this.moving && !this.crouching;
    body.setVelocityX(advancing ? this.runSpeed : 0);

    this.animAcc += delta;
    this.droneAcc += delta;
    if (this.droneAcc > 160) {
      this.droneAcc = 0;
      for (const d of this.drones) {
        d.frame = d.frame === 0 ? 1 : 0;
        d.sprite.setTexture(d.frame === 0 ? 'px-drone-0' : 'px-drone-1');
      }
    }
    if (this.crouching) {
      this.player.setTexture('px-player-crouch');
    } else if (advancing) {
      if (this.animAcc > 130) {
        this.animAcc = 0;
        const next = this.player.texture.key === 'px-player-run0' ? 'px-player-run1' : 'px-player-run0';
        this.player.setTexture(next);
      }
    } else {
      this.player.setTexture('px-player-stand');
    }

    const onFloor = body.blocked.down;
    let detected = false;
    for (const d of this.drones) {
      d.sprite.x += d.dir * d.def.speed * (delta / 1000);
      if (d.sprite.x > d.def.x1) {
        d.sprite.x = d.def.x1;
        d.dir = -1;
      } else if (d.sprite.x < d.def.x0) {
        d.sprite.x = d.def.x0;
        d.dir = 1;
      }
      d.cone.setPosition(d.sprite.x, d.def.y + 14);
      const proximity = Math.abs(this.player.x - d.sprite.x);
      if (proximity < d.def.coneHalf * 1.7) {
        d.cone.setFillStyle(0xff5544, 0.32);
      } else {
        d.cone.setFillStyle(0xffdd44, 0.18);
      }

      const inCone =
        Math.abs(this.player.x - d.sprite.x) < d.def.coneHalf &&
        this.player.y > d.def.y &&
        this.player.y < FLOOR_Y + 20;
      if (!detected && inCone && advancing && onFloor) detected = true;
    }

    if (this.cooldown > 0) {
      // grace window after alarm/subjugation: alert is frozen
    } else if (detected) {
      this.alert += ALERT_RATE * this.alertMult * (delta / 1000);
    } else {
      this.alert = Math.max(0, this.alert - ALERT_DECAY * (delta / 1000));
    }
    if (this.alert >= 100) this.onAlarm();

    if (this.player.y > FLOOR_Y + 160) this.onFall();

    if (this.alertBarBg && this.alertBar) {
      const bx = this.player.x;
      const by = this.player.y - 78;
      this.alertBarBg.setPosition(bx, by);
      const frac = this.alert / 100;
      this.alertBar.width = Math.max(2, 54 * frac);
      this.alertBar.setPosition(bx - 27 + this.alertBar.width / 2, by);
      const visible = frac > 0.01;
      this.alertBarBg.setVisible(visible);
      this.alertBar.setVisible(visible);
      this.alertBar.fillColor = frac > 0.65 ? 0xff3344 : frac > 0.35 ? 0xffaa33 : 0x00ccff;
    }

    if (this.timeText) this.timeText.setText(formatMs(totalRunMs() + this.elapsed));
    if (this.penaltyText) {
      this.penaltyText.setText(
        gameState.penaltyMs > 0 ? `penalties +${formatMs(gameState.penaltyMs)}` : '',
      );
    }
  }

  private playerBody(): Phaser.Physics.Arcade.Body | undefined {
    const b = this.player?.body;
    return b instanceof Phaser.Physics.Arcade.Body ? b : undefined;
  }

  private tryJump() {
    const body = this.playerBody();
    if (!body || this.crouching) return;
    if (body.blocked.down) {
      body.setVelocityY(JUMP_VELOCITY);
      playSoundIfLoaded(this, 'click');
    }
  }

  private setCrouch(active: boolean) {
    this.crouching = active;
  }

  private onAlarm() {
    this.wounds += 1;
    this.alert = 0;
    this.cooldown = 1200;
    gameState.penaltyMs += SPOT_PENALTY_MS;
    this.cameras.main.flash(280, 255, 40, 40);
    if (this.player) burstSquares(this, this.player.x, this.player.y - 20, 0xff5533, 10, 240);
    playSoundIfLoaded(this, 'alarm');
    if (this.player) {
      this.tweens.add({ targets: this.player, alpha: 0.35, duration: 140, yoyo: true, repeat: 5 });
    }
    if (this.woundText) {
      const bar = '\u25a0'.repeat(Math.max(0, MAX_WOUNDS - this.wounds));
      this.woundText.setText(`INTEGRITY ${bar}`);
      this.woundText.setColor(this.wounds >= MAX_WOUNDS - 1 ? '#ff5555' : '#a8b400');
    }
    if (this.wounds >= MAX_WOUNDS) this.onSubjugated();
  }

  private onSubjugated() {
    this.wounds = 0;
    gameState.penaltyMs += SUBJUGATE_PENALTY_MS;
    this.cooldown = 2500;
    this.cameras.main.flash(700, 0, 0, 0);
    playSoundIfLoaded(this, 'alarm');

    const banner = this.add
      .text(this.scale.width / 2, 320, 'SUBJUGATED\nSECTOR RESET', {
        font: 'bold 44px Arial',
        color: '#ff3344',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: 260,
      duration: 1100,
      onComplete: () => banner.destroy(),
    });

    const body = this.playerBody();
    if (body && this.player) {
      body.setVelocity(0, 0);
      this.player.setPosition(60, FLOOR_Y - 60);
      this.cameras.main.centerOn(200, 360);
    }
  }

  private onHazard() {
    if (this.cooldown > 0) return;
    this.cooldown = 1500;
    gameState.penaltyMs += FALL_PENALTY_MS;
    this.cameras.main.flash(250, 255, 60, 60);
    playSoundIfLoaded(this, 'alarm');
    const body = this.playerBody();
    if (body) {
      body.setVelocity(-220, -320);
    }
  }

  private onFall() {
    if (!this.player) return;
    gameState.penaltyMs += FALL_PENALTY_MS;
    this.cameras.main.flash(200, 80, 80, 255);
    burstSquares(this, this.player.x, this.player.y, 0xffffff, 8, 200);
    const body = this.playerBody();
    if (body) body.setVelocity(0, 0);
    this.player.setPosition(60, FLOOR_Y - 60);
  }

  private onReachNpc() {
    if (this.finished) return;
    this.finished = true;
    gameState.timeMs += this.elapsed;
    if (this.slot === 0) markTutorialDone();
    if (this.player) burstSquares(this, this.player.x + 30, this.player.y - 20, 0xffd447, 12, 200);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => {
      this.scene.start('Choice', { i: this.slot });
    });
  }

  private addSolidRect(group: Phaser.Physics.Arcade.StaticGroup, r: Rect, color: number) {
    const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, color);
    group.add(rect);
  }

  private addFloorSegment(group: Phaser.Physics.Arcade.StaticGroup, r: Rect) {
    const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x10141f);
    group.add(rect);
    this.add.rectangle(r.x + r.w / 2, r.y + 4, r.w, 8, 0x33415e).setDepth(-1);
    this.add.rectangle(r.x + r.w / 2, r.y + 14, r.w, 4, 0x1d2637).setDepth(-1);
  }

  private spawnDrone(def: DroneDef) {
    const sprite = this.add.image(def.x0, def.y, 'px-drone-0').setDepth(1).setDisplaySize(40, 20);

    const coneHeight = FLOOR_Y - (def.y + 14);
    const cone = this.add
      .triangle(0, 0, 0, 0, -def.coneHalf, coneHeight, def.coneHalf, coneHeight, 0xffdd44, 0.18)
      .setDepth(0)
      .setPosition(def.x0, def.y + 14);

    this.drones.push({ def, dir: 1, sprite, cone, frame: 0 });
  }

  private makeTextures() {
    if (!this.textures.exists('runner-player')) {
      const g = this.add.graphics();
      g.fillStyle(0x00ffcc);
      g.fillRoundedRect(0, 0, 30, 46, 10);
      g.generateTexture('runner-player', 30, 46);
      g.destroy();
    }
  }
}
