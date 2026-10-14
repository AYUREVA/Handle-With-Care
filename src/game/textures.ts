import Phaser from 'phaser';
import {
  BED_WALL_HEIGHT,
  CAB_BACK_X,
  CAB_FRONT_X,
  CAB_HEIGHT,
  COLORS,
  CRATE_SIZE,
  FLOOR_THICKNESS,
  FLOOR_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  HOOD_HEIGHT,
  TRUCK_LENGTH,
  WHEEL_OFFSET_X,
  WHEEL_RADIUS,
} from './constants';

// Все картинки игры рисуются кодом при запуске: внешних файлов нет.
// Graphics рисует фигуры, generateTexture превращает рисунок в текстуру.

// Размер текстуры пикапа. Центр текстуры = центр корпуса (точка 0,0
// в координатах частей корпуса из constants.ts).
export const TRUCK_TEXTURE_WIDTH = TRUCK_LENGTH + 10;
export const TRUCK_TEXTURE_HEIGHT = 110;
// Ширина бесшовных текстур параллакса.
const PARALLAX_TEXTURE_WIDTH = 1024;
// Размер иконки ящика в HUD.
export const ICON_SIZE = 40;

/** Создаёт все текстуры один раз (повторный вызов ничего не делает). */
export function createTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('truck')) {
    return;
  }
  makeTruck(scene);
  makeWheel(scene);
  makeCrate(scene, 'crate', CRATE_SIZE, false);
  makeCrate(scene, 'crate-cracked', CRATE_SIZE, true);
  makeCrate(scene, 'icon-intact', ICON_SIZE, false);
  makeCrate(scene, 'icon-cracked', ICON_SIZE, true);
  makeBrokenIcon(scene);
  makeDust(scene);
  makeSplinter(scene);
  makeCloud(scene);
  makeBarrier(scene);
  makeSky(scene);
  makeMountains(scene);
  makeHills(scene);
  makeTrees(scene);
}

// Временный Graphics, который не добавляется на сцену.
function newGraphics(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 }, false);
}

// Превращает список чисел [x1, y1, x2, y2, ...] со сдвигом в точки.
function points(coords: number[], ox: number, oy: number): Phaser.Math.Vector2[] {
  const result: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    result.push(new Phaser.Math.Vector2(coords[i] + ox, coords[i + 1] + oy));
  }
  return result;
}

// ===== Пикап =====

function makeTruck(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  // Сдвиг: координаты корпуса (центр в 0,0) → координаты текстуры.
  const ox = TRUCK_TEXTURE_WIDTH / 2;
  const oy = TRUCK_TEXTURE_HEIGHT / 2;
  const half = TRUCK_LENGTH / 2;
  const floorTop = FLOOR_Y - FLOOR_THICKNESS / 2;
  const bottom = FLOOR_Y + FLOOR_THICKNESS / 2;
  const bedTop = floorTop - BED_WALL_HEIGHT;
  const cabTop = floorTop - CAB_HEIGHT;
  const hoodTop = floorTop - HOOD_HEIGHT;

  // Силуэт кузова: борт кузова → кабина → лобовое стекло → капот → бампер.
  const body = points(
    [
      -half, bedTop,
      CAB_BACK_X, bedTop,
      CAB_BACK_X, cabTop + 6,
      CAB_BACK_X + 6, cabTop,
      CAB_FRONT_X - 18, cabTop,
      CAB_FRONT_X, hoodTop,
      half - 6, hoodTop + 2,
      half, hoodTop + 8,
      half, bottom - 4,
      half - 4, bottom,
      -half + 4, bottom,
      -half, bottom - 4,
    ],
    ox,
    oy,
  );
  g.fillStyle(COLORS.truckBody, 1);
  g.fillPoints(body, true);

  // Нижняя тёмная полоса — объём и тень.
  g.fillStyle(COLORS.truckShade, 1);
  g.fillRect(ox - half + 2, oy + bottom - 9, TRUCK_LENGTH - 4, 7);
  // Светлая полоса-молдинг вдоль борта.
  g.fillStyle(COLORS.truckLight, 1);
  g.fillRect(ox - half + 4, oy + bedTop + 4, TRUCK_LENGTH - 12, 3);

  // Окно кабины с бликом.
  const windowPts = points(
    [
      CAB_BACK_X + 7, cabTop + 6,
      CAB_FRONT_X - 21, cabTop + 6,
      CAB_FRONT_X - 7, hoodTop - 2,
      CAB_BACK_X + 7, hoodTop - 2,
    ],
    ox,
    oy,
  );
  g.fillStyle(COLORS.glass, 1);
  g.fillPoints(windowPts, true);
  g.fillStyle(COLORS.glassShine, 0.8);
  g.fillPoints(
    points(
      [
        CAB_BACK_X + 16, cabTop + 6,
        CAB_BACK_X + 24, cabTop + 6,
        CAB_BACK_X + 14, hoodTop - 2,
        CAB_BACK_X + 8, hoodTop - 2,
      ],
      ox,
      oy,
    ),
    true,
  );
  g.lineStyle(2, COLORS.outline, 1);
  g.strokePoints(windowPts, true);
  // Стойка между стёклами.
  g.lineBetween(ox + CAB_BACK_X + 30, oy + cabTop + 6, ox + CAB_BACK_X + 30, oy + hoodTop - 2);

  // Дверь и ручка.
  g.lineStyle(2, COLORS.truckShade, 1);
  g.strokeRoundedRect(ox + CAB_BACK_X + 4, oy + hoodTop + 1, 40, bottom - hoodTop - 12, 4);
  g.fillStyle(COLORS.chrome, 1);
  g.fillRoundedRect(ox + CAB_BACK_X + 10, oy + hoodTop + 6, 9, 3, 1);

  // Зеркало.
  g.fillStyle(COLORS.truckShade, 1);
  g.fillRoundedRect(ox + CAB_FRONT_X - 12, oy + hoodTop - 8, 7, 6, 2);

  // Фара и задний фонарь.
  g.fillStyle(COLORS.headlight, 1);
  g.fillRoundedRect(ox + half - 8, oy + hoodTop + 9, 7, 7, 2);
  g.fillStyle(COLORS.taillight, 1);
  g.fillRect(ox - half + 1, oy + bedTop + 6, 5, 8);

  // Бамперы.
  g.fillStyle(COLORS.chrome, 1);
  g.fillRoundedRect(ox + half - 10, oy + bottom - 7, 14, 7, 3);
  g.fillRoundedRect(ox - half - 4, oy + bottom - 7, 12, 7, 3);

  // Колёсные арки: тёмные полукруги над осями.
  g.fillStyle(COLORS.outline, 1);
  for (const side of [-1, 1]) {
    g.slice(ox + side * WHEEL_OFFSET_X, oy + bottom + 1, WHEEL_RADIUS + 4, Math.PI, Math.PI * 2, false);
    g.fillPath();
  }

  // Общий контур.
  g.lineStyle(3, COLORS.outline, 1);
  g.strokePoints(body, true);

  g.generateTexture('truck', TRUCK_TEXTURE_WIDTH, TRUCK_TEXTURE_HEIGHT);
  g.destroy();
}

// ===== Колесо =====

function makeWheel(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  const r = WHEEL_RADIUS;
  const c = r + 2;
  // Шина.
  g.fillStyle(COLORS.tire, 1);
  g.fillCircle(c, c, r);
  // Протектор: светлые насечки по краю — видно, что колесо крутится.
  g.fillStyle(0x3d3d3d, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillCircle(c + Math.cos(a) * (r - 2.5), c + Math.sin(a) * (r - 2.5), 2);
  }
  // Диск.
  g.fillStyle(COLORS.rim, 1);
  g.fillCircle(c, c, r * 0.58);
  g.fillStyle(COLORS.hub, 1);
  g.fillCircle(c, c, r * 0.28);
  // Спицы-болты.
  g.fillStyle(COLORS.chrome, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.fillCircle(c + Math.cos(a) * r * 0.42, c + Math.sin(a) * r * 0.42, 2);
  }
  // Блик на диске.
  g.lineStyle(2, 0xffffff, 0.6);
  g.beginPath();
  g.arc(c, c, r * 0.48, Math.PI * 1.1, Math.PI * 1.5, false);
  g.strokePath();
  g.lineStyle(2, COLORS.outline, 1);
  g.strokeCircle(c, c, r);
  g.generateTexture('wheel', c * 2, c * 2);
  g.destroy();
}

// ===== Ящики =====

function makeCrate(scene: Phaser.Scene, key: string, size: number, cracked: boolean): void {
  const g = newGraphics(scene);
  drawCrate(g, size, cracked);
  g.generateTexture(key, size, size);
  g.destroy();
}

// Деревянный ящик: доски, диагональная планка, значок «хрупкое» (бокал).
function drawCrate(g: Phaser.GameObjects.Graphics, s: number, cracked: boolean): void {
  const border = Math.max(2, s * 0.09);
  g.fillStyle(COLORS.wood, 1);
  g.fillRect(0, 0, s, s);
  // Щели между досками.
  g.lineStyle(1, COLORS.woodDark, 1);
  for (let i = 1; i < 3; i++) {
    g.lineBetween(border, (s * i) / 3, s - border, (s * i) / 3);
  }
  // Рамка.
  g.fillStyle(COLORS.woodDark, 1);
  g.fillRect(0, 0, s, border);
  g.fillRect(0, s - border, s, border);
  g.fillRect(0, 0, border, s);
  g.fillRect(s - border, 0, border, s);
  // Диагональная планка.
  g.lineStyle(border * 0.9, COLORS.woodDark, 1);
  g.lineBetween(border, s - border, s - border, border);
  // Значок «хрупкое»: бокал на светлой плашке.
  const cx = s / 2;
  const cy = s / 2;
  const k = s / 28;
  g.fillStyle(0xf3e2c4, 1);
  g.fillRoundedRect(cx - 6 * k, cy - 7 * k, 12 * k, 14 * k, 2 * k);
  g.fillStyle(COLORS.fragile, 1);
  g.fillTriangle(cx - 4 * k, cy - 5 * k, cx + 4 * k, cy - 5 * k, cx, cy + 0.5 * k);
  g.fillRect(cx - 0.6 * k, cy, 1.2 * k, 4 * k);
  g.fillRect(cx - 3 * k, cy + 4 * k, 6 * k, 1.4 * k);
  // Контур.
  g.lineStyle(Math.max(1, s * 0.05), COLORS.woodOutline, 1);
  g.strokeRect(0.5, 0.5, s - 1, s - 1);

  if (cracked) {
    // Ломаная трещина через весь ящик и отколотый уголок.
    g.lineStyle(Math.max(1.5, s * 0.07), COLORS.crack, 1);
    g.strokePoints(
      [
        new Phaser.Math.Vector2(s * 0.12, s * 0.05),
        new Phaser.Math.Vector2(s * 0.3, s * 0.3),
        new Phaser.Math.Vector2(s * 0.22, s * 0.48),
        new Phaser.Math.Vector2(s * 0.48, s * 0.62),
        new Phaser.Math.Vector2(s * 0.42, s * 0.8),
        new Phaser.Math.Vector2(s * 0.6, s * 0.97),
      ],
      false,
    );
    g.lineStyle(Math.max(1, s * 0.045), COLORS.crack, 1);
    g.lineBetween(s * 0.48, s * 0.62, s * 0.78, s * 0.55);
    g.fillStyle(COLORS.crack, 1);
    g.fillTriangle(s, 0, s * 0.72, 0, s, s * 0.26);
  }
}

// Иконка разбитого ящика для HUD: кучка досок.
function makeBrokenIcon(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  const s = ICON_SIZE;
  const plank = (x: number, y: number, angle: number, length: number): void => {
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(angle);
    g.fillStyle(COLORS.wood, 1);
    g.fillRect(-length / 2, -3.5, length, 7);
    g.lineStyle(1.5, COLORS.woodOutline, 1);
    g.strokeRect(-length / 2, -3.5, length, 7);
    g.restore();
  };
  plank(s * 0.45, s * 0.78, -0.15, s * 0.8);
  plank(s * 0.35, s * 0.6, 0.5, s * 0.55);
  plank(s * 0.65, s * 0.58, -0.7, s * 0.5);
  g.generateTexture('icon-broken', s, s);
  g.destroy();
}

// ===== Частицы =====

// Мягкое белое пятно: частица пыли (цвет задаётся тинтом).
function makeDust(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  const r = 10;
  for (let i = r; i > 0; i--) {
    g.fillStyle(0xffffff, 0.09);
    g.fillCircle(r, r, i);
  }
  g.generateTexture('dust', r * 2, r * 2);
  g.destroy();
}

// Щепка от ящика.
function makeSplinter(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  g.fillStyle(COLORS.wood, 1);
  g.fillRect(0, 0, 12, 4);
  g.fillStyle(COLORS.woodDark, 1);
  g.fillRect(0, 3, 12, 1);
  g.generateTexture('splinter', 12, 4);
  g.destroy();
}

// ===== Окружение =====

function makeCloud(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  const blobs = [
    [40, 50, 26],
    [72, 38, 32],
    [110, 44, 28],
    [140, 54, 20],
    [90, 58, 24],
  ];
  g.fillStyle(COLORS.cloud, 1);
  for (const [x, y, r] of blobs) {
    g.fillCircle(x, y, r);
  }
  g.fillRect(30, 54, 120, 22);
  // Светлая верхушка — подсветка закатным солнцем.
  g.fillStyle(0xffe3c7, 1);
  for (const [x, y, r] of blobs) {
    g.fillCircle(x - r * 0.15, y - r * 0.2, r * 0.7);
  }
  g.generateTexture('cloud', 180, 80);
  g.destroy();
}

// Полосатый шлагбаум на старте: не даёт уехать назад за начало трассы.
function makeBarrier(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  const w = 30;
  const h = 140;
  g.fillStyle(COLORS.woodDark, 1);
  g.fillRect(9, 0, 12, h);
  for (let i = 0; i < 7; i++) {
    g.fillStyle(i % 2 === 0 ? 0xf5f0e6 : COLORS.fragile, 1);
    g.fillRect(4, 8 + i * 16, 22, 16);
  }
  g.lineStyle(2, COLORS.outline, 1);
  g.strokeRect(4, 8, 22, 112);
  g.strokeRect(9, 0, 12, h);
  g.generateTexture('barrier', w, h);
  g.destroy();
}

// Небо: настоящий плавный градиент рисуется через Canvas 2D,
// потому что градиенты Graphics не попадают в generateTexture.
function makeSky(scene: Phaser.Scene): void {
  const texture = scene.textures.createCanvas('sky', GAME_WIDTH, GAME_HEIGHT);
  if (!texture) {
    return;
  }
  const ctx = texture.getContext();
  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, COLORS.skyTop);
  gradient.addColorStop(0.45, COLORS.skyMid);
  gradient.addColorStop(0.75, COLORS.skyLow);
  gradient.addColorStop(1, COLORS.skyHorizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Звёзды в тёмной верхней части неба.
  const rnd = new Phaser.Math.RandomDataGenerator(['stars']);
  for (let i = 0; i < 60; i++) {
    const y = rnd.between(0, GAME_HEIGHT * 0.35);
    ctx.globalAlpha = (1 - y / (GAME_HEIGHT * 0.35)) * rnd.realInRange(0.3, 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rnd.between(0, GAME_WIDTH), y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Низкое солнце с мягким ореолом.
  const sunX = GAME_WIDTH * 0.72;
  const sunY = GAME_HEIGHT * 0.62;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 220);
  glow.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
  glow.addColorStop(0.25, 'rgba(255, 210, 150, 0.45)');
  glow.addColorStop(1, 'rgba(255, 180, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.fillStyle = '#ffe7a8';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 46, 0, Math.PI * 2);
  ctx.fill();
  texture.refresh();
}

// Бесшовный профиль: сумма синусов с целым числом периодов на ширину
// текстуры, поэтому левый и правый края совпадают.
function profile(x: number, waves: number[][]): number {
  let y = 0;
  for (const [periods, amplitude, phase] of waves) {
    y += Math.sin((x / PARALLAX_TEXTURE_WIDTH) * Math.PI * 2 * periods + phase) * amplitude;
  }
  return y;
}

// Заливка профиля от линии до низа текстуры.
function fillProfile(
  g: Phaser.GameObjects.Graphics,
  height: number,
  baseY: number,
  waves: number[][],
  color: number,
): void {
  const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(0, height)];
  for (let x = 0; x <= PARALLAX_TEXTURE_WIDTH; x += 8) {
    pts.push(new Phaser.Math.Vector2(x, baseY + profile(x, waves)));
  }
  pts.push(new Phaser.Math.Vector2(PARALLAX_TEXTURE_WIDTH, height));
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
}

function makeMountains(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  const h = 300;
  const waves = [
    [2, 55, 0.4],
    [5, 30, 1.7],
    [11, 10, 0.9],
  ];
  fillProfile(g, h, 150, waves, COLORS.mountainsFar);
  // Светлая подсветка склонов: тот же профиль чуть ниже и светлее по краю.
  g.lineStyle(3, 0xa45a8a, 0.8);
  const ridge: Phaser.Math.Vector2[] = [];
  for (let x = 0; x <= PARALLAX_TEXTURE_WIDTH; x += 8) {
    ridge.push(new Phaser.Math.Vector2(x, 151 + profile(x, waves)));
  }
  g.strokePoints(ridge, false);
  g.generateTexture('mountains', PARALLAX_TEXTURE_WIDTH, h);
  g.destroy();
}

function makeHills(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  const h = 240;
  fillProfile(
    g,
    h,
    120,
    [
      [3, 34, 2.1],
      [7, 16, 0.3],
    ],
    COLORS.hillsNear,
  );
  g.generateTexture('hills', PARALLAX_TEXTURE_WIDTH, h);
  g.destroy();
}

// Ближний слой: силуэты ёлок, круглых деревьев и столбов с проводами.
function makeTrees(scene: Phaser.Scene): void {
  const g = newGraphics(scene);
  const h = 200;
  const groundY = 150;
  const waves = [
    [4, 8, 0.5],
    [9, 4, 2.0],
  ];
  fillProfile(g, h, groundY, waves, COLORS.silhouette);
  g.fillStyle(COLORS.silhouette, 1);

  // Деревья — по псевдослучайным, но постоянным местам.
  const rnd = new Phaser.Math.RandomDataGenerator(['trees']);
  for (let x = 20; x < PARALLAX_TEXTURE_WIDTH - 20; x += rnd.between(28, 70)) {
    const base = groundY + profile(x, waves) + 4;
    const size = rnd.between(18, 34);
    if (rnd.frac() < 0.6) {
      // Ёлка из трёх треугольников.
      for (let i = 0; i < 3; i++) {
        const w = size * (1 - i * 0.22);
        const y = base - i * size * 0.5;
        g.fillTriangle(x - w / 2, y, x + w / 2, y, x, y - size * 0.9);
      }
    } else {
      // Круглое дерево на стволе.
      g.fillRect(x - 2, base - size * 0.6, 4, size * 0.6);
      g.fillCircle(x, base - size * 0.85, size * 0.45);
      g.fillCircle(x - size * 0.3, base - size * 0.65, size * 0.3);
      g.fillCircle(x + size * 0.3, base - size * 0.65, size * 0.3);
    }
  }

  // Столбы с провисающими проводами. Шаг кратен ширине — провод без шва.
  const poleCount = 4;
  const poleStep = PARALLAX_TEXTURE_WIDTH / poleCount;
  const poleHeight = 82;
  const tops: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= poleCount; i++) {
    const x = i * poleStep + poleStep / 2;
    const px = x % PARALLAX_TEXTURE_WIDTH;
    const base = groundY + profile(px, waves) + 4;
    tops.push(new Phaser.Math.Vector2(x, base - poleHeight));
    if (i < poleCount) {
      g.fillRect(px - 2.5, base - poleHeight, 5, poleHeight);
      g.fillRect(px - 12, base - poleHeight + 6, 24, 3);
    }
  }
  g.lineStyle(1.5, COLORS.silhouette, 1);
  for (let i = 0; i < poleCount; i++) {
    const a = tops[i];
    const b = tops[i + 1];
    const wire: Phaser.Math.Vector2[] = [];
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const sag = Math.sin(t * Math.PI) * 14;
      wire.push(new Phaser.Math.Vector2(a.x + (b.x - a.x) * t, a.y + 7 + (b.y - a.y) * t + sag));
    }
    // Часть провода за правым краем переносим на левый — шов незаметен.
    g.strokePoints(wire, false);
    g.strokePoints(
      wire.map((p) => new Phaser.Math.Vector2(p.x - PARALLAX_TEXTURE_WIDTH, p.y)),
      false,
    );
  }
  g.generateTexture('trees', PARALLAX_TEXTURE_WIDTH, h);
  g.destroy();
}
