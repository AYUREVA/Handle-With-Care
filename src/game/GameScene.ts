import Phaser from 'phaser';
import { Crate, type CrateState } from './cargo';
import {
  BED_WALL_THICKNESS,
  BEST_DISTANCE_KEY,
  BEST_SCORE_KEY,
  CAB_BACK_X,
  CAMERA_LERP_X,
  CAMERA_LERP_Y,
  CAMERA_LOOKAHEAD,
  CAMERA_LOOKAHEAD_MAX,
  CAMERA_OFFSET_Y,
  CAMERA_ZOOM_FAST,
  CAMERA_ZOOM_LERP,
  CAMERA_ZOOM_SLOW,
  CAMERA_ZOOM_SPEED,
  COLORS,
  CRACKED_CRATE_BONUS,
  CRATE_BONUS,
  CRATE_CLEANUP_DISTANCE,
  CRATE_COUNT,
  CRATE_GAP,
  CRATE_LOST_DISTANCE,
  CRATE_SIZE,
  CRATE_WAKE_SPEED,
  DUST_FREQUENCY,
  DUST_LANDING_BURST,
  DUST_MIN_SPIN,
  FLIP_TIME,
  FLOOR_THICKNESS,
  FLOOR_Y,
  GAME_WIDTH,
  LANDING_SHAKE_DURATION,
  LANDING_SHAKE_INTENSITY,
  LANDING_SHAKE_MAX,
  LANDING_SHAKE_SPEED,
  GAME_SPEED,
  MAX_PHYSICS_STEPS_PER_FRAME,
  PHYSICS_STEP_MS,
  PIXELS_PER_METER,
  RESULTS_DELAY,
  SPLINTERS_BREAK,
  SPLINTERS_CRACK,
  TRACK_SEED,
  TRUCK_LENGTH,
  TRUCK_START_X,
  WHEEL_RADIUS,
} from './constants';
import { GROUND_LABEL, Terrain } from './terrain';
import { createTextures } from './textures';
import { type Throttle, Truck } from './truck';

// Состояние игры: титульный экран → заезд → итоги.
export type GameState = 'title' | 'playing' | 'over';

// Итоги заезда для экрана результатов.
export interface GameResult {
  reason: string;
  meters: number;
  bonus: number;
  score: number;
  bestScore: number;
  isNewBest: boolean;
}

// Ключ в registry: после рестарта сразу начинать заезд, без титула.
const SKIP_TITLE_KEY = 'skipTitle';

// Рекорды в localStorage. В приватном режиме хранилище может быть
// недоступно — тогда просто играем без рекорда.
function loadNumber(key: string): number {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function saveNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Хранилище недоступно — рекорд не сохранится, игра продолжается.
  }
}

/**
 * Основная сцена: трасса, машина, груз, физика, камера и эффекты.
 * Интерфейс (титул, HUD, итоги) рисует UIScene, читая поля этой сцены.
 */
export class GameScene extends Phaser.Scene {
  // ===== То, что читает UIScene =====
  state: GameState = 'title';
  meters = 0;
  bestMeters = 0;
  bestScore = 0;
  // Доля времени на крыше до поражения (0..1).
  flipProgress = 0;
  result: GameResult | null = null;
  // Экран итогов уже можно показать (прошла пауза после поражения).
  resultsReady = false;

  private terrain!: Terrain;
  private truck!: Truck;
  private crates: Crate[] = [];
  private keys!: {
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
  };
  private throttle: Throttle = 0;
  // Накопленное время для фиксированного шага физики.
  private physicsTime = 0;
  // Сколько мс машина уже лежит на крыше.
  private upsideDownTime = 0;
  private maxX = TRUCK_START_X;
  // Камера: точка, за которой она следит, упреждение и зум.
  private cameraTarget = new Phaser.Math.Vector2();
  private lookahead = 0;
  private zoom = CAMERA_ZOOM_SLOW;
  private dustEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private landingDust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splinters!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: 'GameScene', active: true });
  }

  create(): void {
    createTextures(this);
    this.resetState();
    this.bestMeters = loadNumber(BEST_DISTANCE_KEY);
    this.bestScore = loadNumber(BEST_SCORE_KEY);

    const seed = TRACK_SEED ?? String(Date.now());
    this.terrain = new Terrain(this, seed, this.bestMeters);
    this.terrain.update(TRUCK_START_X);
    this.truck = new Truck(this, TRUCK_START_X, this.terrain.heightAt(TRUCK_START_X));
    this.createCrates();
    this.createEffects();
    this.setupCamera();
    this.setupInput();
    this.setupCollisions();

    if (this.registry.get(SKIP_TITLE_KEY) === true) {
      this.state = 'playing';
    }
  }

  // Сцена перезапускается через scene.restart — поля надо сбросить.
  private resetState(): void {
    this.state = 'title';
    this.meters = 0;
    this.flipProgress = 0;
    this.result = null;
    this.resultsReady = false;
    this.crates = [];
    this.throttle = 0;
    this.physicsTime = 0;
    this.upsideDownTime = 0;
    this.maxX = TRUCK_START_X;
    this.lookahead = 0;
    this.zoom = CAMERA_ZOOM_SLOW;
    this.dustEmitters = [];
  }

  // ===== Создание =====

  // Три ящика в ряд на полу кузова.
  private createCrates(): void {
    const floorTop = FLOOR_Y - FLOOR_THICKNESS / 2;
    const firstX = -TRUCK_LENGTH / 2 + BED_WALL_THICKNESS + CRATE_GAP + CRATE_SIZE / 2;
    for (let i = 0; i < CRATE_COUNT; i++) {
      const local = { x: firstX + i * (CRATE_SIZE + CRATE_GAP), y: floorTop - CRATE_SIZE / 2 - 1 };
      const world = this.truck.localToWorld(local.x, local.y);
      this.crates.push(new Crate(this, world.x, world.y));
    }
  }

  private createEffects(): void {
    // Пыль из-под колёс: каждое колесо — свой источник, следующий за колесом.
    for (const wheel of this.truck.wheelImages) {
      const emitter = this.add.particles(0, 0, 'dust', {
        emitting: false,
        frequency: DUST_FREQUENCY,
        lifespan: { min: 450, max: 900 },
        speedX: { min: -90, max: -20 },
        speedY: { min: -60, max: -10 },
        scale: { start: 0.5, end: 1.8 },
        alpha: { start: 0.55, end: 0 },
        tint: COLORS.dust,
        gravityY: -15,
      });
      emitter.startFollow(wheel, 0, WHEEL_RADIUS - 4);
      emitter.setDepth(7);
      this.dustEmitters.push(emitter);
    }
    // Облако пыли при жёстком приземлении.
    this.landingDust = this.add.particles(0, 0, 'dust', {
      emitting: false,
      lifespan: { min: 400, max: 800 },
      speed: { min: 40, max: 140 },
      angle: { min: 190, max: 350 },
      scale: { start: 0.6, end: 2 },
      alpha: { start: 0.6, end: 0 },
      tint: COLORS.dust,
    });
    this.landingDust.setDepth(7);
    // Щепки от ящиков.
    this.splinters = this.add.particles(0, 0, 'splinter', {
      emitting: false,
      lifespan: { min: 700, max: 1300 },
      speed: { min: 90, max: 280 },
      angle: { min: 200, max: 340 },
      rotate: { start: 0, end: 720 },
      gravityY: 900,
      alpha: { start: 1, end: 0, ease: 'cubic.in' },
    });
    this.splinters.setDepth(8);
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    this.updateCameraTarget(1);
    cam.startFollow(this.cameraTarget, false, CAMERA_LERP_X, CAMERA_LERP_Y);
    cam.centerOn(this.cameraTarget.x, this.cameraTarget.y);
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [keyboard.addKey(K.LEFT), keyboard.addKey(K.A)],
      right: [keyboard.addKey(K.RIGHT), keyboard.addKey(K.D)],
    };
    keyboard.on('keydown-SPACE', () => this.onStartPressed());
    this.input.on('pointerdown', () => this.onStartPressed());
  }

  // Пробел или касание: старт на титуле, рестарт на итогах.
  private onStartPressed(): void {
    if (this.state === 'title') {
      this.state = 'playing';
    } else if (this.state === 'over' && this.resultsReady) {
      this.registry.set(SKIP_TITLE_KEY, true);
      this.scene.restart();
    }
  }

  private setupCollisions(): void {
    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      for (const pair of event.pairs) {
        this.onContact(pair, true);
      }
    });
    this.matter.world.on('collisionactive', (event: Phaser.Physics.Matter.Events.CollisionActiveEvent) => {
      for (const pair of event.pairs) {
        this.onContact(pair, false);
      }
    });
  }

  // ===== Столкновения =====

  // isStart — первое касание (удар), иначе — касание продолжается.
  private onContact(pair: Phaser.Types.Physics.Matter.MatterCollisionPair, isStart: boolean): void {
    const a = pair.bodyA.parent;
    const b = pair.bodyB.parent;
    const now = this.physicsNow();
    // Проверяем пару в обе стороны: (a, b) и (b, a).
    for (const [self, other] of [
      [a, b],
      [b, a],
    ]) {
      const wheelIndex = this.truck.wheelIndexOf(self);
      if (wheelIndex >= 0 && other.label === GROUND_LABEL) {
        this.truck.markWheelOnGround(wheelIndex, now);
        if (isStart) {
          this.onWheelLanding(self, this.impactSpeed(pair, self, other));
        }
      }
      const crate = this.crates.find((c) => c.isCarried && c.body === self);
      if (crate && isStart) {
        this.onCrateHit(crate, other, this.impactSpeed(pair, self, other), now);
      }
    }
  }

  // Сила удара: скорость сближения тел вдоль нормали контакта.
  // Matter вызывает collisionstart до того, как развёл тела, поэтому
  // скорости здесь ещё «до удара».
  private impactSpeed(
    pair: Phaser.Types.Physics.Matter.MatterCollisionPair,
    self: MatterJS.BodyType,
    other: MatterJS.BodyType,
  ): number {
    const n = pair.collision.normal;
    const va = this.pointVelocity(self, self.position);
    const vb = this.pointVelocity(other, self.position);
    return Math.abs((va.x - vb.x) * n.x + (va.y - vb.y) * n.y);
  }

  // Скорость точки тела с учётом вращения (важно для кузова: если машина
  // кувыркается, край кузова движется быстрее центра).
  private pointVelocity(body: MatterJS.BodyType, point: MatterJS.Vector): MatterJS.Vector {
    if (body.isStatic) {
      return { x: 0, y: 0 };
    }
    const rx = point.x - body.position.x;
    const ry = point.y - body.position.y;
    const w = body.angularVelocity;
    return { x: body.velocity.x - w * ry, y: body.velocity.y + w * rx };
  }

  private onWheelLanding(wheel: MatterJS.BodyType, speed: number): void {
    if (speed < LANDING_SHAKE_SPEED) {
      return;
    }
    const intensity = Math.min(LANDING_SHAKE_MAX, (speed - LANDING_SHAKE_SPEED + 1) * LANDING_SHAKE_INTENSITY);
    this.cameras.main.shake(LANDING_SHAKE_DURATION, intensity);
    this.landingDust.explode(DUST_LANDING_BURST, wheel.position.x, wheel.position.y + WHEEL_RADIUS - 4);
  }

  private onCrateHit(crate: Crate, other: MatterJS.BodyType, speed: number, now: number): void {
    // Коснулся земли — значит, выпал из кузова.
    if (other.label === GROUND_LABEL) {
      crate.markLost();
      return;
    }
    const { x, y } = crate;
    const result = crate.hit(speed, now);
    if (result === 'cracked') {
      this.splinters.explode(SPLINTERS_CRACK, x, y);
    } else if (result === 'broken') {
      this.splinters.explode(SPLINTERS_BREAK, x, y);
      this.cameras.main.shake(150, 0.004);
    }
  }

  // ===== Кадр игры =====

  update(_time: number, delta: number): void {
    this.throttle = this.state === 'playing' ? this.readThrottle() : 0;
    this.stepPhysics(delta);
    this.terrain.update(this.truck.x);
    this.updateCrates();
    this.updateDust();
    this.updateCamera();
    if (this.state === 'playing') {
      this.updateScore();
      this.checkGameOver(delta);
    }
  }

  // Газ/тормоз с клавиатуры и касаний (правая/левая половина экрана).
  private readThrottle(): Throttle {
    let gas = this.keys?.right.some((k) => k.isDown) ?? false;
    let brake = this.keys?.left.some((k) => k.isDown) ?? false;
    for (const pointer of this.input.manager.pointers) {
      if (pointer.isDown) {
        if (pointer.x >= GAME_WIDTH / 2) {
          gas = true;
        } else {
          brake = true;
        }
      }
    }
    if (gas && !brake) {
      return 1;
    }
    if (brake && !gas) {
      return -1;
    }
    return 0;
  }

  // Фиксированный шаг: физика всегда шагает по PHYSICS_STEP_MS,
  // сколько бы ни длился кадр.
  private stepPhysics(delta: number): void {
    // GAME_SPEED < 1 — физика идёт чуть медленнее реального времени.
    this.physicsTime += delta * GAME_SPEED;
    let steps = 0;
    while (this.physicsTime >= PHYSICS_STEP_MS && steps < MAX_PHYSICS_STEPS_PER_FRAME) {
      // Matter обнуляет моменты после каждого шага — задаём их перед каждым.
      this.truck.applyControls(this.throttle, this.physicsNow());
      // Запоминаем положение «до шага» — для плавной отрисовки.
      this.truck.savePrevious();
      for (const crate of this.crates) {
        crate.view.savePrevious();
      }
      this.matter.world.step(PHYSICS_STEP_MS);
      this.truck.limitSpeeds();
      this.physicsTime -= PHYSICS_STEP_MS;
      steps++;
    }
    // Если кадр был очень долгим, не пытаемся догнать всё сразу.
    this.physicsTime = Math.min(this.physicsTime, PHYSICS_STEP_MS);
    // Остаток времени до следующего шага (0..1): рисуем картинки между
    // прошлым и текущим шагом, поэтому на 120 и 144 Гц нет дёрганья.
    const alpha = this.physicsTime / PHYSICS_STEP_MS;
    this.truck.render(alpha, delta);
    for (const crate of this.crates) {
      if (!crate.removed) {
        crate.view.render(alpha);
      }
    }
  }

  // Время физического мира (мс) — растёт только когда шагает физика.
  private physicsNow(): number {
    return this.matter.world.engine.timing.timestamp;
  }

  private updateCrates(): void {
    const awake = this.truck.speed > CRATE_WAKE_SPEED || this.throttle !== 0;
    // Центр кузова в координатах корпуса.
    const bedCenterX = (-TRUCK_LENGTH / 2 + BED_WALL_THICKNESS + CAB_BACK_X) / 2;
    const bedCenterY = FLOOR_Y - FLOOR_THICKNESS / 2 - CRATE_SIZE / 2;
    for (const crate of this.crates) {
      if (crate.isCarried) {
        if (awake) {
          crate.wake();
        }
        const local = this.truck.worldToLocal(crate.x, crate.y);
        if (Phaser.Math.Distance.Between(local.x, local.y, bedCenterX, bedCenterY) > CRATE_LOST_DISTANCE) {
          crate.markLost();
        }
      } else if (crate.state === 'broken') {
        // Разбитый ящик: щепки уже разлетелись, убираем тело.
        crate.remove();
      } else if (crate.state === 'lost' && this.truck.x - crate.x > CRATE_CLEANUP_DISTANCE) {
        // Выпавший ящик далеко позади — убираем.
        crate.remove();
      }
    }
  }

  // Пыль летит, когда колесо на земле, буксует вперёд и нажат газ.
  private updateDust(): void {
    const now = this.physicsNow();
    this.truck.wheels.forEach((wheel, i) => {
      const spin = wheel.angularVelocity;
      this.dustEmitters[i].emitting =
        this.throttle > 0 && spin > DUST_MIN_SPIN && this.truck.isWheelOnGround(i, now);
    });
  }

  // Камера смотрит чуть вперёд по ходу и отдаляется на скорости.
  private updateCamera(): void {
    this.updateCameraTarget(0.05);
    const speedT = Phaser.Math.Clamp(this.truck.speed / CAMERA_ZOOM_SPEED, 0, 1);
    const targetZoom = Phaser.Math.Linear(CAMERA_ZOOM_SLOW, CAMERA_ZOOM_FAST, speedT);
    this.zoom += (targetZoom - this.zoom) * CAMERA_ZOOM_LERP;
    this.cameras.main.setZoom(this.zoom);
  }

  // smoothing — насколько быстро упреждение догоняет нужное значение (0..1).
  private updateCameraTarget(smoothing: number): void {
    const wanted = Phaser.Math.Clamp(
      this.truck.velocity.x * CAMERA_LOOKAHEAD,
      -CAMERA_LOOKAHEAD_MAX / 2,
      CAMERA_LOOKAHEAD_MAX,
    );
    this.lookahead += (wanted - this.lookahead) * smoothing;
    const truck = this.truck.renderPosition;
    this.cameraTarget.set(truck.x + this.lookahead, truck.y + CAMERA_OFFSET_Y);
  }

  // ===== Счёт и поражение =====

  private updateScore(): void {
    this.maxX = Math.max(this.maxX, this.truck.x);
    this.meters = Math.floor((this.maxX - TRUCK_START_X) / PIXELS_PER_METER);
  }

  private checkGameOver(delta: number): void {
    // Переворот: лежит на крыше FLIP_TIME подряд.
    this.upsideDownTime = this.truck.isUpsideDown() ? this.upsideDownTime + delta : 0;
    this.flipProgress = Math.min(1, this.upsideDownTime / FLIP_TIME);
    if (this.upsideDownTime >= FLIP_TIME) {
      this.endGame('Машина перевернулась');
      return;
    }
    // Груз: ни одного ящика в кузове.
    if (this.crates.every((c) => !c.isCarried)) {
      const allBroken = this.crates.every((c) => c.state === 'broken');
      const allLost = this.crates.every((c) => c.state === 'lost');
      this.endGame(allBroken ? 'Все ящики разбиты' : allLost ? 'Весь груз выпал' : 'Груз не уцелел');
    }
  }

  private endGame(reason: string): void {
    this.state = 'over';
    this.flipProgress = 0;
    const bonus = this.crates.reduce(
      (sum, c) => sum + (c.state === 'intact' ? CRATE_BONUS : c.state === 'cracked' ? CRACKED_CRATE_BONUS : 0),
      0,
    );
    const score = this.meters + bonus;
    const isNewBest = score > this.bestScore;
    if (isNewBest) {
      this.bestScore = score;
      saveNumber(BEST_SCORE_KEY, score);
    }
    if (this.meters > this.bestMeters) {
      this.bestMeters = this.meters;
      saveNumber(BEST_DISTANCE_KEY, this.meters);
    }
    this.result = { reason, meters: this.meters, bonus, score, bestScore: this.bestScore, isNewBest };
    this.time.delayedCall(RESULTS_DELAY, () => {
      this.resultsReady = true;
    });
  }

  // ===== Для других сцен =====

  /** Состояние каждого ящика (для иконок HUD). */
  crateStates(): CrateState[] {
    return this.crates.map((c) => c.state);
  }
}
