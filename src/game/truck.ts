import Phaser from 'phaser';
import { BodyImage } from './bodyImage';
import {
  AIR_SPIN_ACCEL,
  AIR_SPIN_MAX,
  ARM_LENGTH,
  BED_WALL_HEIGHT,
  BED_WALL_THICKNESS,
  BRAKE_SOFT_SPIN,
  BRAKE_TORQUE,
  BUMP_STOP_STIFFNESS,
  CAB_BACK_X,
  CAB_FRONT_X,
  CAB_HEIGHT,
  CHASSIS_AIR_FRICTION,
  CHASSIS_DENSITY,
  CHASSIS_FRICTION,
  COLORS,
  DRIVE_REACTION,
  DRIVE_TORQUE,
  FLIP_ANGLE,
  FLOOR_THICKNESS,
  FLOOR_Y,
  GROUND_CONTACT_GRACE,
  HOOD_HEIGHT,
  MAX_REVERSE_SPIN,
  MAX_SPEED,
  MAX_WHEEL_SPIN,
  REVERSE_TORQUE,
  SPRING_PRELOAD,
  SUSPENSION_DAMPING,
  SUSPENSION_STIFFNESS,
  SUSPENSION_TRAVEL_DOWN,
  SUSPENSION_TRAVEL_UP,
  THROTTLE_RESPONSE,
  WHEEL_SIDES,
  WHEEL_VISUAL_SMOOTHING,
  TRUCK_LENGTH,
  WHEEL_AIR_FRICTION,
  WHEEL_DENSITY,
  WHEEL_FRICTION,
  WHEEL_FRICTION_STATIC,
  WHEEL_OFFSET_X,
  WHEEL_OFFSET_Y,
  WHEEL_RADIUS,
} from './constants';

// Скругление углов кабины и капота: машина на крыше не цепляется углами.
const CAB_CHAMFER = 6;
// Колесо крутится вперёд быстрее этого — значит, «назад» сейчас тормоз.
const BRAKE_SPIN_THRESHOLD = 0.02;
// Аварийный предел вращения колеса (рад/шаг), на случай резкого спуска.
const WHEEL_SPIN_HARD_LIMIT = 1.0;
// Жёсткость рычага подвески (почти жёсткий стержень).
const ARM_STIFFNESS = 0.9;
// Где на корпусе крепится верх пружины (Y относительно центра пикапа).
const SPRING_TOP_Y = FLOOR_Y - 6;
// Вид амортизатора: толщина и цвета.
const SHOCK_WIDTH = 9;
const SHOCK_COLOR = 0x3a3f47;
const SPRING_COLOR = 0xf2c14e;

// Газ: 1 — вперёд, -1 — тормоз/назад, 0 — отпущено.
export type Throttle = -1 | 0 | 1;

// Подвеска одного колеса: пружина, её длина в покое и точка крепления
// верха пружины в координатах картинки пикапа.
interface Suspension {
  spring: MatterJS.ConstraintType;
  restLength: number;
  topLocal: Phaser.Math.Vector2;
}

/**
 * Пикап: корпус из нескольких прямоугольников (пол, задний бортик, кабина,
 * капот), два колеса, у каждого — рычаг и пружина с амортизатором.
 *
 * Координаты частей задаются относительно центра картинки пикапа.
 */
export class Truck {
  readonly chassis: MatterJS.BodyType;
  // Колёса: [0] — заднее, [1] — переднее.
  readonly wheels: MatterJS.BodyType[];
  // Картинки колёс (за ними следует пыль).
  readonly wheelImages: Phaser.GameObjects.Image[];
  // Все картинки, которые следуют за телами машины.
  private readonly views: BodyImage[] = [];
  private readonly suspensions: Suspension[] = [];
  // Центр картинки пикапа относительно центра масс корпуса (при угле 0).
  private readonly imageOffset: Phaser.Math.Vector2;
  // Амортизаторы рисуются каждый кадр между корпусом и колёсами.
  private readonly shocks: Phaser.GameObjects.Graphics;
  // Время (мс физики) последнего касания земли каждым колесом.
  private readonly wheelGroundTime: number[] = [-Infinity, -Infinity];
  // Сглаженное положение картинок колёс в координатах корпуса.
  private readonly wheelLocal: (Phaser.Math.Vector2 | null)[] = [null, null];
  // Положение педали газа: плавно движется к нажатой кнопке (-1..1).
  private pedal = 0;
  // Функции Matter для изменения скорости тел.
  private readonly bodyTools: MatterJS.BodyFactory;

  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    this.bodyTools = scene.matter.body;
    // Ставим машину так, чтобы колёса чуть-чуть висели над землёй.
    const y = groundY - WHEEL_OFFSET_Y - WHEEL_RADIUS - 2;
    // Отрицательная группа: корпус и колёса не сталкиваются друг с другом.
    const group = scene.matter.world.nextGroup(true);

    this.chassis = this.createChassis(scene, x, y, group);
    // Центр масс не совпадает с центром картинки: пол тяжелее кабины.
    this.imageOffset = new Phaser.Math.Vector2(x - this.chassis.position.x, y - this.chassis.position.y);
    const truckImage = scene.add.image(x, y, 'truck').setDepth(5);
    this.views.push(new BodyImage(this.chassis, truckImage, this.imageOffset.x, this.imageOffset.y));
    this.shocks = scene.add.graphics().setDepth(5.5);

    this.wheels = [];
    this.wheelImages = [];
    for (const side of [-1, 1]) {
      const axleX = x + side * WHEEL_OFFSET_X;
      // Колесо — многоугольник с большим числом граней (почти круг).
      const wheel = scene.matter.bodies.polygon(axleX, y + WHEEL_OFFSET_Y, WHEEL_SIDES, WHEEL_RADIUS, {
        density: WHEEL_DENSITY,
        friction: WHEEL_FRICTION,
        frictionStatic: WHEEL_FRICTION_STATIC,
        frictionAir: WHEEL_AIR_FRICTION,
        restitution: 0,
        collisionFilter: { group, category: 0x0001, mask: 0xffffffff },
        label: 'wheel',
        sleepThreshold: Infinity,
      });
      scene.matter.world.add(wheel);
      const image = scene.add.image(axleX, y + WHEEL_OFFSET_Y, 'wheel').setDepth(6);
      this.wheels.push(wheel);
      this.wheelImages.push(image);
      this.views.push(new BodyImage(wheel, image));
      this.addSuspension(scene, wheel, side, x, y);
    }
  }

  // Корпус — одно составное тело из прямоугольников.
  private createChassis(scene: Phaser.Scene, x: number, y: number, group: number): MatterJS.BodyType {
    const half = TRUCK_LENGTH / 2;
    const floorTop = FLOOR_Y - FLOOR_THICKNESS / 2;
    const filter = { group, category: 0x0001, mask: 0xffffffff };
    const part = (cx: number, cy: number, w: number, h: number, chamfer = 0): MatterJS.BodyType =>
      scene.matter.bodies.rectangle(x + cx, y + cy, w, h, {
        density: CHASSIS_DENSITY,
        collisionFilter: filter,
        chamfer: chamfer > 0 ? { radius: chamfer } : undefined,
      });

    const parts = [
      // Пол кузова и кабины (во всю длину).
      part(0, FLOOR_Y, TRUCK_LENGTH, FLOOR_THICKNESS),
      // Задний бортик.
      part(-half + BED_WALL_THICKNESS / 2, floorTop - BED_WALL_HEIGHT / 2, BED_WALL_THICKNESS, BED_WALL_HEIGHT),
      // Кабина — она же передний борт кузова.
      part((CAB_BACK_X + CAB_FRONT_X) / 2, floorTop - CAB_HEIGHT / 2, CAB_FRONT_X - CAB_BACK_X, CAB_HEIGHT, CAB_CHAMFER),
      // Капот.
      part((CAB_FRONT_X + half) / 2, floorTop - HOOD_HEIGHT / 2, half - CAB_FRONT_X, HOOD_HEIGHT, CAB_CHAMFER),
    ];
    const chassis = scene.matter.body.create({
      parts,
      friction: CHASSIS_FRICTION,
      frictionAir: CHASSIS_AIR_FRICTION,
      restitution: 0,
      collisionFilter: filter,
      label: 'truck',
      // Корпус никогда не «засыпает».
      sleepThreshold: Infinity,
    });
    scene.matter.world.add(chassis);
    return chassis;
  }

  // Подвеска колеса:
  // 1) рычаг — почти жёсткий стержень от точки ближе к центру машины до оси.
  //    Колесо может ходить по дуге вверх-вниз, но не вперёд-назад;
  // 2) пружина с амортизатором — вертикально от корпуса над осью до оси.
  //    Она держит вес машины и мягко гасит кочки.
  private addSuspension(scene: Phaser.Scene, wheel: MatterJS.BodyType, side: number, x: number, y: number): void {
    const axleX = x + side * WHEEL_OFFSET_X;
    const axleY = y + WHEEL_OFFSET_Y;
    // Точка относительно центра масс корпуса — так их ждёт Matter.
    const toChassis = (px: number, py: number): MatterJS.Vector => ({
      x: px - this.chassis.position.x,
      y: py - this.chassis.position.y,
    });

    const pivotX = axleX - side * ARM_LENGTH;
    scene.matter.add.constraint(this.chassis, wheel, ARM_LENGTH, ARM_STIFFNESS, {
      pointA: toChassis(pivotX, axleY),
      pointB: { x: 0, y: 0 },
    });

    const topY = y + SPRING_TOP_Y;
    const restLength = axleY - topY + SPRING_PRELOAD;
    const spring = scene.matter.add.constraint(this.chassis, wheel, restLength, SUSPENSION_STIFFNESS, {
      pointA: toChassis(axleX, topY),
      pointB: { x: 0, y: 0 },
      damping: SUSPENSION_DAMPING,
    });
    this.suspensions.push({ spring, restLength, topLocal: new Phaser.Math.Vector2(side * WHEEL_OFFSET_X, SPRING_TOP_Y) });
  }

  // ===== Управление (вызывается перед каждым шагом физики) =====

  applyControls(throttle: Throttle, now: number): void {
    // Педаль плавно догоняет кнопку: машина трогается без рывка.
    this.pedal += Phaser.Math.Clamp(throttle - this.pedal, -THROTTLE_RESPONSE, THROTTLE_RESPONSE);
    this.updateBumpStops();
    const onGround = this.isOnGround(now);
    for (const wheel of this.wheels) {
      this.driveWheel(wheel, onGround);
    }
    if (!onGround && throttle !== 0) {
      this.airControl(throttle);
    }
  }

  // Отбойники: если колесо ушло за пределы хода подвески, пружина
  // становится жёсткой и не даёт колесу «провалиться» в кузов.
  private updateBumpStops(): void {
    for (const { spring, restLength } of this.suspensions) {
      const length = this.springLength(spring);
      const outOfTravel =
        length < restLength - SPRING_PRELOAD - SUSPENSION_TRAVEL_UP ||
        length > restLength - SPRING_PRELOAD + SUSPENSION_TRAVEL_DOWN;
      spring.stiffness = outOfTravel ? BUMP_STOP_STIFFNESS : SUSPENSION_STIFFNESS;
    }
  }

  // Текущая длина пружины: от точки на корпусе до оси колеса.
  // Matter сам поворачивает pointA вместе с корпусом.
  private springLength(spring: MatterJS.ConstraintType): number {
    const wheel = spring.bodyB as MatterJS.BodyType;
    const topX = this.chassis.position.x + spring.pointA.x;
    const topY = this.chassis.position.y + spring.pointA.y;
    return Phaser.Math.Distance.Between(topX, topY, wheel.position.x, wheel.position.y);
  }

  // Момент на колесо. Положительный момент крутит колесо по часовой
  // стрелке — машина едет вправо.
  private driveWheel(wheel: MatterJS.BodyType, onGround: boolean): void {
    const spin = wheel.angularVelocity;
    let torque = 0;
    if (this.pedal > 0) {
      // Мотор слабеет по мере разгона и на MAX_WHEEL_SPIN не тянет вовсе:
      // скорость ограничивается плавно, без включения-выключения.
      const power = 1 - Math.pow(Phaser.Math.Clamp(spin / MAX_WHEEL_SPIN, 0, 1), 2);
      torque = DRIVE_TORQUE * this.pedal * power;
    } else if (this.pedal < 0) {
      if (spin > BRAKE_SPIN_THRESHOLD) {
        // Тормоз: у самой остановки плавно отпускает.
        torque = -BRAKE_TORQUE * -this.pedal * Math.min(1, spin / BRAKE_SOFT_SPIN);
      } else {
        const power = 1 - Phaser.Math.Clamp(-spin / MAX_REVERSE_SPIN, 0, 1);
        torque = -REVERSE_TORQUE * -this.pedal * power;
      }
    }
    wheel.torque += torque;
    // Мотор крутит колесо, а корпус в ответ поворачивается в обратную
    // сторону: на газу нос приподнимается, на тормозе — клюёт.
    if (onGround) {
      this.chassis.torque -= torque * DRIVE_REACTION;
    }
  }

  // В воздухе газ наклоняет машину назад, тормоз — вперёд (как в Hill Climb).
  private airControl(throttle: Throttle): void {
    const current = this.chassis.angularVelocity;
    // Отрицательная угловая скорость — поворот против часовой (нос вверх).
    const direction = throttle > 0 ? -1 : 1;
    const next = current + direction * AIR_SPIN_ACCEL;
    if (Math.abs(next) <= AIR_SPIN_MAX || Math.sign(next) !== direction) {
      this.bodyTools.setAngularVelocity(this.chassis, next);
    }
  }

  /** Ограничивает скорости после шага физики (защита от проваливания). */
  limitSpeeds(): void {
    const v = this.chassis.velocity;
    const speed = Math.hypot(v.x, v.y);
    if (speed > MAX_SPEED) {
      const k = MAX_SPEED / speed;
      this.bodyTools.setVelocity(this.chassis, { x: v.x * k, y: v.y * k });
    }
    for (const wheel of this.wheels) {
      const spin = Phaser.Math.Clamp(wheel.angularVelocity, -WHEEL_SPIN_HARD_LIMIT, WHEEL_SPIN_HARD_LIMIT);
      if (spin !== wheel.angularVelocity) {
        this.bodyTools.setAngularVelocity(wheel, spin);
      }
    }
  }

  // ===== Отрисовка =====

  /** Запомнить положение тел перед шагом физики (для плавной отрисовки). */
  savePrevious(): void {
    for (const view of this.views) {
      view.savePrevious();
    }
  }

  /**
   * Нарисовать машину между двумя шагами физики (alpha 0..1).
   * delta — время кадра (мс), нужно для сглаживания колёс.
   */
  render(alpha: number, delta: number): void {
    for (const view of this.views) {
      view.render(alpha);
    }
    this.smoothWheels(delta);
    this.drawShocks();
  }

  // Картинка колеса плавно догоняет физическое колесо относительно корпуса:
  // мелкая быстрая дрожь гасится, а ход подвески и прыжки остаются.
  private smoothWheels(delta: number): void {
    const follow = WHEEL_VISUAL_SMOOTHING > 0 ? 1 - Math.exp(-delta / WHEEL_VISUAL_SMOOTHING) : 1;
    this.wheelImages.forEach((image, i) => {
      const target = this.imageToLocal(image.x, image.y);
      const current = this.wheelLocal[i] ?? target.clone();
      current.lerp(target, follow);
      this.wheelLocal[i] = current;
      const world = this.localToImage(current.x, current.y);
      image.setPosition(world.x, world.y);
    });
  }

  // Амортизаторы: тёмный цилиндр и жёлтая пружина от корпуса до оси.
  private drawShocks(): void {
    const g = this.shocks;
    g.clear();
    this.suspensions.forEach(({ topLocal }, i) => {
      // Концы берём у картинок (а не у тел), чтобы не отставать от них.
      const top = this.localToImage(topLocal.x, topLocal.y);
      const bottom = this.wheelImages[i];
      g.lineStyle(SHOCK_WIDTH, SHOCK_COLOR, 1);
      g.lineBetween(top.x, top.y, bottom.x, bottom.y);
      // Витки пружины — зигзаг поверх цилиндра.
      const coils = 5;
      const dx = bottom.x - top.x;
      const dy = bottom.y - top.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const points: Phaser.Math.Vector2[] = [];
      for (let k = 0; k <= coils * 2; k++) {
        const t = 0.05 + (0.6 * k) / (coils * 2);
        const sideShift = k === 0 || k === coils * 2 ? 0 : k % 2 === 0 ? -7 : 7;
        points.push(new Phaser.Math.Vector2(top.x + dx * t + nx * sideShift, top.y + dy * t + ny * sideShift));
      }
      g.lineStyle(3.5, SPRING_COLOR, 1);
      g.strokePoints(points, false);
      g.fillStyle(COLORS.outline, 1);
      g.fillCircle(top.x, top.y, 3.5);
    });
  }

  // Точка корпуса (координаты картинки) → мир по текущей картинке пикапа.
  private localToImage(x: number, y: number): Phaser.Math.Vector2 {
    const image = this.views[0].image;
    return new Phaser.Math.Vector2(x, y).rotate(image.rotation).add(new Phaser.Math.Vector2(image.x, image.y));
  }

  // Обратное: точка мира → координаты картинки пикапа.
  private imageToLocal(x: number, y: number): Phaser.Math.Vector2 {
    const image = this.views[0].image;
    return new Phaser.Math.Vector2(x - image.x, y - image.y).rotate(-image.rotation);
  }

  // ===== Касание земли =====

  /** Номер колеса для тела (или -1, если это не колесо). */
  wheelIndexOf(body: MatterJS.BodyType): number {
    return this.wheels.indexOf(body);
  }

  markWheelOnGround(index: number, now: number): void {
    this.wheelGroundTime[index] = now;
  }

  isWheelOnGround(index: number, now: number): boolean {
    return now - this.wheelGroundTime[index] < GROUND_CONTACT_GRACE;
  }

  isOnGround(now: number): boolean {
    return this.isWheelOnGround(0, now) || this.isWheelOnGround(1, now);
  }

  // ===== Положение =====

  /** Точка мира → координаты корпуса (центр картинки, без поворота). */
  worldToLocal(x: number, y: number): Phaser.Math.Vector2 {
    const fromCenterOfMass = new Phaser.Math.Vector2(x - this.chassis.position.x, y - this.chassis.position.y);
    return fromCenterOfMass.rotate(-this.chassis.angle).subtract(this.imageOffset);
  }

  /** Точка корпуса → мировые координаты (по физике, не по картинке). */
  localToWorld(x: number, y: number): Phaser.Math.Vector2 {
    const fromCenterOfMass = new Phaser.Math.Vector2(x + this.imageOffset.x, y + this.imageOffset.y);
    return fromCenterOfMass.rotate(this.chassis.angle).add(this.chassis.position);
  }

  /** Где машина нарисована сейчас (за этой точкой плавно следует камера). */
  get renderPosition(): Phaser.Math.Vector2 {
    const image = this.views[0].image;
    return new Phaser.Math.Vector2(image.x, image.y);
  }

  get x(): number {
    return this.chassis.position.x;
  }

  get y(): number {
    return this.chassis.position.y;
  }

  get velocity(): MatterJS.Vector {
    return this.chassis.velocity;
  }

  get speed(): number {
    return Math.hypot(this.chassis.velocity.x, this.chassis.velocity.y);
  }

  /** Машина лежит на крыше (угол больше FLIP_ANGLE). */
  isUpsideDown(): boolean {
    const angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Wrap(this.chassis.angle));
    return Math.abs(angle) > FLIP_ANGLE;
  }
}
