import Phaser from 'phaser';
import {
  CAMERA_OFFSET_Y,
  CLOUD_DRIFT_SPEED,
  COLORS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_BASE_Y,
  PARALLAX_CLOUDS,
  PARALLAX_HILLS,
  PARALLAX_MOUNTAINS,
  PARALLAX_TREES,
  PARALLAX_VERTICAL,
  PARALLAX_VERTICAL_MAX,
} from './constants';
import { createTextures } from './textures';

// Слой параллакса: полоса из двух одинаковых картинок подряд. Когда одна
// уезжает за край, её место занимает вторая — полоса бесконечна.
interface Layer {
  images: Phaser.GameObjects.Image[];
  // Заливка под полосой, чтобы при сдвиге вверх не было видно неба снизу.
  filler: Phaser.GameObjects.Rectangle;
  baseY: number;
  factor: number;
}

// Облака: сколько и на какой высоте.
const CLOUD_COUNT = 5;
const CLOUD_MIN_Y = 40;
const CLOUD_MAX_Y = 220;
// Запас по краям, чтобы облако уходило за экран целиком.
const CLOUD_MARGIN = 200;
// Высота камеры на старте — от неё считается вертикальный параллакс.
const START_CAMERA_Y = GROUND_BASE_Y + CAMERA_OFFSET_Y;

/**
 * Фон: небо, облака и слои параллакса.
 * Своя камера без зума, читает положение камеры GameScene.
 */
export class BackgroundScene extends Phaser.Scene {
  private layers: Layer[] = [];
  private clouds: { image: Phaser.GameObjects.Image; baseX: number; factor: number }[] = [];

  constructor() {
    super({ key: 'BackgroundScene', active: true });
  }

  create(): void {
    createTextures(this);
    this.add.image(0, 0, 'sky').setOrigin(0, 0);
    this.createClouds();
    this.layers = [
      this.createLayer('mountains', 170, PARALLAX_MOUNTAINS, COLORS.mountainsFar),
      this.createLayer('hills', 250, PARALLAX_HILLS, COLORS.hillsNear),
      this.createLayer('trees', 290, PARALLAX_TREES, COLORS.silhouette),
    ];
  }

  private createLayer(key: string, y: number, factor: number, fillColor: number): Layer {
    const images = [0, 1].map(() => this.add.image(0, y, key).setOrigin(0, 0));
    const filler = this.add
      .rectangle(0, y + images[0].height - 1, GAME_WIDTH, GAME_HEIGHT, fillColor)
      .setOrigin(0, 0);
    return { images, filler, baseY: y, factor };
  }

  private createClouds(): void {
    const rnd = new Phaser.Math.RandomDataGenerator(['clouds']);
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const image = this.add
        .image(0, rnd.between(CLOUD_MIN_Y, CLOUD_MAX_Y), 'cloud')
        .setScale(rnd.realInRange(0.6, 1.2))
        .setAlpha(rnd.realInRange(0.55, 0.9));
      this.clouds.push({
        image,
        baseX: (i / CLOUD_COUNT) * (GAME_WIDTH + CLOUD_MARGIN * 2),
        // Дальние (маленькие) облака движутся медленнее.
        factor: PARALLAX_CLOUDS * image.scale,
      });
    }
  }

  update(time: number): void {
    const game = this.scene.get('GameScene');
    const view = game.cameras.main.midPoint;
    // Вертикальный сдвиг: камера поднялась на холм — фон чуть опускается.
    const dy = Phaser.Math.Clamp(
      -(view.y - START_CAMERA_Y) * PARALLAX_VERTICAL,
      -PARALLAX_VERTICAL_MAX,
      PARALLAX_VERTICAL_MAX,
    );
    for (const layer of this.layers) {
      const width = layer.images[0].width;
      const x = -Phaser.Math.Wrap(view.x * layer.factor, 0, width);
      // Ближние слои сдвигаются по вертикали сильнее дальних.
      const y = layer.baseY + dy * (0.5 + layer.factor);
      layer.images.forEach((image, i) => image.setPosition(x + i * width, y));
      layer.filler.y = y + layer.images[0].height - 1;
    }
    const wrap = GAME_WIDTH + CLOUD_MARGIN * 2;
    for (const cloud of this.clouds) {
      const shift = view.x * cloud.factor + (time / 1000) * CLOUD_DRIFT_SPEED * cloud.image.scale;
      cloud.image.x = Phaser.Math.Wrap(cloud.baseX - shift, 0, wrap) - CLOUD_MARGIN;
    }
  }
}
