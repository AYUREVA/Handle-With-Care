import Phaser from 'phaser';
import { BodyImage } from './bodyImage';
import {
  CRATE_AIR_FRICTION,
  CRATE_CRACK_SPEED,
  CRATE_DENSITY,
  CRATE_FRICTION,
  CRATE_FRICTION_STATIC,
  CRATE_HIT_COOLDOWN,
  CRATE_RESTITUTION,
  CRATE_SIZE,
  CRATE_SLEEP_THRESHOLD,
} from './constants';

// Состояние ящика: целый, треснул, разбит, потерян (выпал из кузова).
export type CrateState = 'intact' | 'cracked' | 'broken' | 'lost';

// Что произошло с ящиком от удара.
export type HitResult = 'none' | 'cracked' | 'broken';

/**
 * Хрупкий ящик. Свободно лежит в кузове.
 * Первый сильный удар — трещина, второй — ящик разбит.
 */
export class Crate {
  readonly body: MatterJS.BodyType;
  readonly view: BodyImage;
  state: CrateState = 'intact';
  // Тело и картинка уже удалены со сцены.
  removed = false;
  private readonly scene: Phaser.Scene;
  // Время (мс физики) последнего засчитанного удара.
  private lastHitTime = -Infinity;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.body = scene.matter.bodies.rectangle(x, y, CRATE_SIZE, CRATE_SIZE, {
      density: CRATE_DENSITY,
      friction: CRATE_FRICTION,
      frictionStatic: CRATE_FRICTION_STATIC,
      frictionAir: CRATE_AIR_FRICTION,
      restitution: CRATE_RESTITUTION,
      // Небольшое скругление: ящик не цепляется острым углом за борт.
      chamfer: { radius: 2 },
      label: 'crate',
      sleepThreshold: CRATE_SLEEP_THRESHOLD,
    });
    scene.matter.world.add(this.body);
    this.view = new BodyImage(this.body, scene.add.image(x, y, 'crate').setDepth(4));
  }

  get x(): number {
    return this.body.position.x;
  }

  get y(): number {
    return this.body.position.y;
  }

  /** Ящик ещё в игре (не разбит и не потерян). */
  get isCarried(): boolean {
    return this.state === 'intact' || this.state === 'cracked';
  }

  /**
   * Удар с силой impactSpeed (скорость сближения по нормали).
   * Возвращает, что случилось с ящиком.
   */
  hit(impactSpeed: number, now: number): HitResult {
    if (!this.isCarried || impactSpeed < CRATE_CRACK_SPEED || now - this.lastHitTime < CRATE_HIT_COOLDOWN) {
      return 'none';
    }
    this.lastHitTime = now;
    if (this.state === 'intact') {
      this.state = 'cracked';
      this.view.image.setTexture('crate-cracked');
      return 'cracked';
    }
    // Само тело удалит GameScene после шага физики (remove): удалять тело
    // прямо во время расчёта столкновений нельзя.
    this.state = 'broken';
    this.view.image.setVisible(false);
    return 'broken';
  }

  /** Ящик выпал: остаётся лежать на трассе, но больше не считается. */
  markLost(): void {
    if (this.isCarried) {
      this.state = 'lost';
      this.view.image.setAlpha(0.75);
    }
  }

  /**
   * Будит ящик, если он «уснул» (спящее тело Matter не двигается).
   * Так же делает сам Matter в Sleeping.set(body, false).
   */
  wake(): void {
    if (this.isCarried && this.body.isSleeping) {
      // sleepCounter есть у тела Matter, но не описан в типах Phaser.
      const body = this.body as MatterJS.BodyType & { sleepCounter: number };
      body.isSleeping = false;
      body.sleepCounter = 0;
    }
  }

  /** Удалить тело и картинку со сцены. */
  remove(): void {
    if (!this.removed) {
      this.removed = true;
      this.scene.matter.world.remove(this.body);
      this.view.image.destroy();
    }
  }
}
