import Phaser from 'phaser';
import {
  BARRIER_X,
  CHUNK_WIDTH,
  CHUNKS_AHEAD,
  CHUNKS_BEHIND,
  COLORS,
  FONT_FAMILY,
  GRASS_THICKNESS,
  GROUND_BASE_Y,
  GROUND_FRICTION,
  GROUND_THICKNESS,
  GROUND_VISUAL_DEPTH,
  HILL_LAYERS,
  HILL_RAMP_DISTANCE,
  HILL_START_SCALE,
  MARKER_EVERY_METERS,
  PEBBLES_PER_CHUNK,
  PIXELS_PER_METER,
  SEGMENT_WIDTH,
  SOIL_BAND_DEPTH,
  SOIL_BANDS,
  START_BLEND_LENGTH,
  START_FLAT_LENGTH,
  TRUCK_START_X,
} from './constants';

// Метка физических тел земли: по ней узнаём, что колесо или ящик коснулись земли.
export const GROUND_LABEL = 'ground';
// Длина плавного появления нового слоя холмов (px).
const LAYER_FADE_IN = 3000;
// Высота невидимой стены у шлагбаума (чтобы не перепрыгнуть назад).
const BARRIER_WALL_HEIGHT = 900;

// Кусок трассы: физические отрезки земли, картинка и таблички.
interface Chunk {
  bodies: MatterJS.BodyType[];
  graphics: Phaser.GameObjects.Graphics;
  decorations: Phaser.GameObjects.GameObject[];
}

// Плавная «ступенька» от 0 до 1 (без резких изломов).
function smooth01(t: number): number {
  const c = Phaser.Math.Clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Бесконечная процедурная трасса.
 *
 * Высота земли — чистая функция heightAt(x): одна и та же для одного seed,
 * поэтому любой кусок можно создать заново. Куски создаются впереди машины
 * и удаляются позади.
 */
export class Terrain {
  private readonly scene: Phaser.Scene;
  // Фазы синусов для каждого слоя холмов (из seed).
  private readonly phases: number[];
  // Живые куски трассы по номеру.
  private readonly chunks = new Map<number, Chunk>();
  // Рекорд в метрах: на этом месте ставим флажок.
  private readonly bestMeters: number;

  constructor(scene: Phaser.Scene, seed: string, bestMeters: number) {
    this.scene = scene;
    this.bestMeters = bestMeters;
    const rnd = new Phaser.Math.RandomDataGenerator([seed]);
    this.phases = HILL_LAYERS.map(() => rnd.realInRange(0, Math.PI * 2));
    this.createBarrier();
  }

  /** Y поверхности земли в точке x (чем больше Y, тем ниже). */
  heightAt(x: number): number {
    if (x <= START_FLAT_LENGTH) {
      return GROUND_BASE_Y;
    }
    const d = x - START_FLAT_LENGTH;
    // Плавный выход со стартовой площадки.
    const blend = smooth01(d / START_BLEND_LENGTH);
    // Чем дальше, тем выше холмы.
    const scale = HILL_START_SCALE + (1 - HILL_START_SCALE) * smooth01(d / HILL_RAMP_DISTANCE);
    let sum = 0;
    HILL_LAYERS.forEach((layer, i) => {
      const fadeIn = layer.rampStart > 0 ? smooth01((d - layer.rampStart) / LAYER_FADE_IN) : 1;
      // Вычитаем sin(фазы), чтобы на краю площадки слой начинался с нуля.
      const wave = Math.sin((d / layer.wavelength) * Math.PI * 2 + this.phases[i]) - Math.sin(this.phases[i]);
      sum += wave * layer.amplitude * fadeIn;
    });
    return GROUND_BASE_Y - sum * scale * blend;
  }

  /** Создаёт куски вокруг x и удаляет далёкие. Вызывать каждый кадр. */
  update(x: number): void {
    const current = Math.floor(x / CHUNK_WIDTH);
    const first = current - CHUNKS_BEHIND;
    const last = current + CHUNKS_AHEAD;
    for (let i = first; i <= last; i++) {
      if (!this.chunks.has(i)) {
        this.chunks.set(i, this.createChunk(i));
      }
    }
    for (const [index, chunk] of this.chunks) {
      if (index < first || index > last) {
        this.destroyChunk(chunk);
        this.chunks.delete(index);
      }
    }
  }

  // ===== Создание куска =====

  private createChunk(index: number): Chunk {
    const x0 = index * CHUNK_WIDTH;
    const x1 = x0 + CHUNK_WIDTH;
    const surface: Phaser.Math.Vector2[] = [];
    for (let x = x0; x <= x1; x += SEGMENT_WIDTH) {
      surface.push(new Phaser.Math.Vector2(x, this.heightAt(x)));
    }
    return {
      bodies: this.createGroundBodies(surface),
      graphics: this.drawGround(index, surface),
      decorations: this.createMarkers(x0, x1),
    };
  }

  // Физика: каждый отрезок — выпуклый четырёхугольник с вертикальными боками.
  // Соседи делят общий бок точно, поэтому на стыках нет щелей и ступенек.
  private createGroundBodies(surface: Phaser.Math.Vector2[]): MatterJS.BodyType[] {
    const bodies: MatterJS.BodyType[] = [];
    for (let i = 0; i < surface.length - 1; i++) {
      const a = surface[i];
      const b = surface[i + 1];
      const vertices = [
        { x: a.x, y: a.y },
        { x: b.x, y: b.y },
        { x: b.x, y: b.y + GROUND_THICKNESS },
        { x: a.x, y: a.y + GROUND_THICKNESS },
      ];
      // Центр параллелограмма — среднее его вершин.
      const position = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + GROUND_THICKNESS / 2 };
      const body = this.scene.matter.body.create({
        position,
        vertices,
        isStatic: true,
        friction: GROUND_FRICTION,
        frictionStatic: GROUND_FRICTION,
        label: GROUND_LABEL,
      });
      bodies.push(body);
    }
    this.scene.matter.world.add(bodies);
    return bodies;
  }

  // Картинка: полосы почвы (темнее вглубь), трава, контур, камешки.
  private drawGround(index: number, surface: Phaser.Math.Vector2[]): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics().setDepth(0);
    // Сдвиг вниз от поверхности: возвращает полигон «линия → дно».
    const band = (offset: number): Phaser.Math.Vector2[] => {
      const pts = surface.map((p) => new Phaser.Math.Vector2(p.x, p.y + offset));
      const last = surface[surface.length - 1];
      pts.push(new Phaser.Math.Vector2(last.x, last.y + GROUND_VISUAL_DEPTH));
      pts.push(new Phaser.Math.Vector2(surface[0].x, surface[0].y + GROUND_VISUAL_DEPTH));
      return pts;
    };
    const top = Phaser.Display.Color.ValueToColor(COLORS.soilTop);
    const deep = Phaser.Display.Color.ValueToColor(COLORS.soilDeep);
    for (let i = 0; i < SOIL_BANDS; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, deep, SOIL_BANDS - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillPoints(band(i * SOIL_BAND_DEPTH), true);
    }

    // Камешки: постоянные для куска (свой генератор на номер куска).
    const rnd = new Phaser.Math.RandomDataGenerator([`pebbles-${index}`]);
    for (let i = 0; i < PEBBLES_PER_CHUNK; i++) {
      const x = rnd.realInRange(surface[0].x, surface[surface.length - 1].x);
      const y = this.heightAt(x) + rnd.realInRange(GRASS_THICKNESS + 8, SOIL_BAND_DEPTH * SOIL_BANDS);
      g.fillStyle(COLORS.soilDeep, rnd.realInRange(0.25, 0.5));
      g.fillEllipse(x, y, rnd.realInRange(5, 12), rnd.realInRange(3, 7));
    }

    // Трава: полоса от поверхности на GRASS_THICKNESS вниз.
    const grass: Phaser.Math.Vector2[] = surface.map((p) => p.clone());
    for (let i = surface.length - 1; i >= 0; i--) {
      grass.push(new Phaser.Math.Vector2(surface[i].x, surface[i].y + GRASS_THICKNESS));
    }
    g.fillStyle(COLORS.grass, 1);
    g.fillPoints(grass, true);
    // Светлый блик по верху травы и тёмный контур кромки.
    g.lineStyle(3, COLORS.grassLight, 1);
    g.strokePoints(surface.map((p) => new Phaser.Math.Vector2(p.x, p.y + 2.5)), false);
    g.lineStyle(3, COLORS.outline, 1);
    g.strokePoints(surface, false);
    return g;
  }

  // Таблички «100 м», «200 м»… и флажок рекорда.
  private createMarkers(x0: number, x1: number): Phaser.GameObjects.GameObject[] {
    const result: Phaser.GameObjects.GameObject[] = [];
    const step = MARKER_EVERY_METERS * PIXELS_PER_METER;
    const firstMeter = Math.ceil((x0 - TRUCK_START_X) / step) * MARKER_EVERY_METERS;
    for (let m = Math.max(firstMeter, MARKER_EVERY_METERS); ; m += MARKER_EVERY_METERS) {
      const x = TRUCK_START_X + m * PIXELS_PER_METER;
      if (x >= x1) {
        break;
      }
      result.push(...this.createSign(x, `${m} м`, COLORS.wood));
    }
    const bestX = TRUCK_START_X + this.bestMeters * PIXELS_PER_METER;
    if (this.bestMeters > 0 && bestX >= x0 && bestX < x1) {
      result.push(...this.createSign(bestX, `Рекорд ${this.bestMeters} м`, COLORS.uiPanel, true));
    }
    return result;
  }

  private createSign(x: number, label: string, color: number, isFlag = false): Phaser.GameObjects.GameObject[] {
    const y = this.heightAt(x);
    const postHeight = isFlag ? 110 : 70;
    const g = this.scene.add.graphics().setDepth(-1);
    g.fillStyle(COLORS.woodOutline, 1);
    g.fillRect(x - 3, y - postHeight, 6, postHeight + 6);
    const text = this.scene.add
      .text(x, y - postHeight, label, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: isFlag ? COLORS.uiAccent : '#3b2314',
      })
      .setOrigin(0.5, 1)
      .setDepth(-1);
    const w = text.width + 16;
    const h = text.height + 8;
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - w / 2, y - postHeight - h, w, h, 5);
    g.lineStyle(2, COLORS.outline, 1);
    g.strokeRoundedRect(x - w / 2, y - postHeight - h, w, h, 5);
    text.setY(y - postHeight - 4);
    return [g, text];
  }

  // Шлагбаум на старте + невидимая высокая стена за ним.
  private createBarrier(): void {
    const y = this.heightAt(BARRIER_X);
    this.scene.add.image(BARRIER_X, y + 6, 'barrier').setOrigin(0.5, 1).setDepth(-1);
    this.scene.matter.add.rectangle(BARRIER_X, y - BARRIER_WALL_HEIGHT / 2, 24, BARRIER_WALL_HEIGHT, {
      isStatic: true,
      label: 'barrier',
    });
  }

  private destroyChunk(chunk: Chunk): void {
    this.scene.matter.world.remove(chunk.bodies);
    chunk.graphics.destroy();
    for (const item of chunk.decorations) {
      item.destroy();
    }
  }
}
