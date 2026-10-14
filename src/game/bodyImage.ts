import Phaser from 'phaser';

/**
 * Картинка, которая плавно следует за физическим телом.
 *
 * Физика шагает 60 раз в секунду, а экран может обновляться 120 или 144
 * раз. Если просто ставить картинку туда, где тело сейчас, на таких
 * экранах она дёргается: в одном кадре тело сдвинулось, в следующем нет.
 * Поэтому мы помним положение тела до последнего шага и рисуем картинку
 * между «было» и «стало» (интерполяция).
 */
export class BodyImage {
  readonly body: MatterJS.BodyType;
  readonly image: Phaser.GameObjects.Image;
  // Смещение центра картинки от центра масс тела (в координатах тела).
  private readonly offset: Phaser.Math.Vector2;
  private prevX: number;
  private prevY: number;
  private prevAngle: number;

  constructor(body: MatterJS.BodyType, image: Phaser.GameObjects.Image, offsetX = 0, offsetY = 0) {
    this.body = body;
    this.image = image;
    this.offset = new Phaser.Math.Vector2(offsetX, offsetY);
    this.prevX = body.position.x;
    this.prevY = body.position.y;
    this.prevAngle = body.angle;
    this.render(1);
  }

  /** Запомнить положение перед шагом физики. */
  savePrevious(): void {
    this.prevX = this.body.position.x;
    this.prevY = this.body.position.y;
    this.prevAngle = this.body.angle;
  }

  /** Нарисовать картинку между прошлым (alpha = 0) и текущим (alpha = 1) положением. */
  render(alpha: number): void {
    const x = Phaser.Math.Linear(this.prevX, this.body.position.x, alpha);
    const y = Phaser.Math.Linear(this.prevY, this.body.position.y, alpha);
    const angle = Phaser.Math.Linear(this.prevAngle, this.body.angle, alpha);
    const offset = this.offset.clone().rotate(angle);
    this.image.setPosition(x + offset.x, y + offset.y);
    this.image.setRotation(angle);
  }
}
