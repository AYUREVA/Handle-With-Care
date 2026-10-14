import Phaser from 'phaser';
import type { CrateState } from './cargo';
import { COLORS, CRATE_COUNT, FLIP_TIME, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from './constants';
import type { GameScene } from './GameScene';
import { createTextures, ICON_SIZE } from './textures';

// Отступ HUD от краёв экрана.
const HUD_MARGIN = 24;
// Расстояние между иконками ящиков.
const ICON_GAP = 8;
// Размер панели итогов.
const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 380;
// Прозрачность иконки выпавшего ящика.
const LOST_ICON_ALPHA = 0.3;

// Текстура иконки для каждого состояния ящика.
const ICON_BY_STATE: Record<CrateState, string> = {
  intact: 'icon-intact',
  cracked: 'icon-cracked',
  broken: 'icon-broken',
  lost: 'icon-intact',
};

// Общий стиль текста: светлый, жирный, с тёмной обводкой — читается на любом фоне.
function textStyle(size: number, color: string = COLORS.uiText): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    stroke: COLORS.uiStroke,
    strokeThickness: Math.max(4, Math.round(size / 6)),
    align: 'center',
  };
}

/**
 * Интерфейс поверх игры: титульный экран, HUD и итоги.
 * Сам ничего не решает — каждый кадр показывает состояние GameScene.
 */
export class UIScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Container;
  private titleBest!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Container;
  private distanceText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private flipText!: Phaser.GameObjects.Text;
  private icons: Phaser.GameObjects.Image[] = [];
  private lastStates: CrateState[] = [];
  private results!: Phaser.GameObjects.Container;
  private resultTexts!: {
    reason: Phaser.GameObjects.Text;
    details: Phaser.GameObjects.Text;
    score: Phaser.GameObjects.Text;
    best: Phaser.GameObjects.Text;
  };

  constructor() {
    super({ key: 'UIScene', active: true });
  }

  create(): void {
    createTextures(this);
    this.createTitle();
    this.createHud();
    this.createResults();
  }

  // ===== Титульный экран =====

  private createTitle(): void {
    const cx = GAME_WIDTH / 2;
    const name = this.add.text(cx, 150, 'Осторожно,\nхрупкое!', textStyle(68)).setOrigin(0.5);
    name.setLineSpacing(-8);
    const subtitle = this.add
      .text(cx, 262, 'Довези три ящика по холмам — и не разбей их', textStyle(22, COLORS.uiAccent))
      .setOrigin(0.5);
    const start = this.add.text(cx, 352, 'Нажми ПРОБЕЛ или тапни', textStyle(30)).setOrigin(0.5);
    const controls = this.add
      .text(
        cx,
        GAME_HEIGHT - 70,
        '→ / D — газ      ← / A — тормоз и назад\nНа телефоне: правая половина — газ, левая — тормоз',
        textStyle(17),
      )
      .setOrigin(0.5);
    this.titleBest = this.add.text(cx, 302, '', textStyle(20, COLORS.uiAccent)).setOrigin(0.5);
    this.title = this.add.container(0, 0, [name, subtitle, start, controls, this.titleBest]);
    // Надпись «нажми» мягко пульсирует.
    this.tweens.add({ targets: start, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ===== HUD =====

  private createHud(): void {
    this.distanceText = this.add.text(HUD_MARGIN, HUD_MARGIN - 6, '0 м', textStyle(46)).setOrigin(0, 0);
    this.distanceText.setAlign('left');
    this.bestText = this.add
      .text(HUD_MARGIN + 2, HUD_MARGIN + 52, '', textStyle(20, COLORS.uiAccent))
      .setOrigin(0, 0);
    this.flipText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, '', textStyle(40, COLORS.uiDanger))
      .setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [this.distanceText, this.bestText, this.flipText];
    for (let i = 0; i < CRATE_COUNT; i++) {
      const x = GAME_WIDTH - HUD_MARGIN - ICON_SIZE / 2 - (CRATE_COUNT - 1 - i) * (ICON_SIZE + ICON_GAP);
      const icon = this.add.image(x, HUD_MARGIN + ICON_SIZE / 2, 'icon-intact');
      this.icons.push(icon);
      items.push(icon);
    }
    this.hud = this.add.container(0, 0, items);
  }

  // ===== Итоги =====

  private createResults(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.35);
    panel.fillRoundedRect(cx - PANEL_WIDTH / 2 + 6, cy - PANEL_HEIGHT / 2 + 10, PANEL_WIDTH, PANEL_HEIGHT, 24);
    panel.fillStyle(COLORS.uiPanel, 0.97);
    panel.fillRoundedRect(cx - PANEL_WIDTH / 2, cy - PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 24);
    panel.lineStyle(4, 0xffd38a, 1);
    panel.strokeRoundedRect(cx - PANEL_WIDTH / 2, cy - PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 24);

    const reason = this.add.text(cx, cy - 135, '', textStyle(38, COLORS.uiDanger)).setOrigin(0.5);
    const details = this.add.text(cx, cy - 55, '', textStyle(24)).setOrigin(0.5).setLineSpacing(6);
    const score = this.add.text(cx, cy + 30, '', textStyle(52, COLORS.uiAccent)).setOrigin(0.5);
    const best = this.add.text(cx, cy + 90, '', textStyle(24)).setOrigin(0.5);
    const again = this.add.text(cx, cy + 148, 'Пробел / клик — ещё раз', textStyle(22)).setOrigin(0.5);
    this.tweens.add({ targets: again, alpha: 0.45, duration: 650, yoyo: true, repeat: -1 });
    this.resultTexts = { reason, details, score, best };
    this.results = this.add.container(0, 0, [panel, reason, details, score, best, again]);
    this.results.setVisible(false);
  }

  private showResults(game: GameScene): void {
    const r = game.result;
    if (!r) {
      return;
    }
    this.resultTexts.reason.setText(r.reason);
    this.resultTexts.details.setText(`Расстояние: ${r.meters} м\nБонус за ящики: +${r.bonus}`);
    this.resultTexts.score.setText(`Счёт: ${r.score}`);
    this.resultTexts.best.setText(r.isNewBest ? 'Новый рекорд!' : `Рекорд: ${r.bestScore}`);
    this.resultTexts.best.setColor(r.isNewBest ? COLORS.uiAccent : COLORS.uiText);
    this.results.setVisible(true).setAlpha(0).setScale(0.9);
    this.results.setPosition((GAME_WIDTH * 0.1) / 2, (GAME_HEIGHT * 0.1) / 2);
    // Панель плавно «выезжает»: масштаб вокруг центра экрана.
    this.tweens.add({
      targets: this.results,
      alpha: 1,
      scale: 1,
      x: 0,
      y: 0,
      duration: 260,
      ease: 'Back.easeOut',
    });
  }

  // ===== Каждый кадр =====

  update(): void {
    const game = this.scene.get('GameScene') as GameScene;
    this.title.setVisible(game.state === 'title');
    this.hud.setVisible(game.state !== 'title');
    this.titleBest.setText(game.bestScore > 0 ? `Рекорд: ${game.bestScore}` : '');

    this.distanceText.setText(`${game.meters} м`);
    this.bestText.setText(game.bestMeters > 0 ? `Рекорд: ${Math.max(game.bestMeters, game.meters)} м` : '');
    this.updateFlipWarning(game.flipProgress);
    this.updateIcons(game.crateStates());

    const wantResults = game.state === 'over' && game.resultsReady;
    if (wantResults && !this.results.visible) {
      this.showResults(game);
    } else if (!wantResults && this.results.visible) {
      this.results.setVisible(false);
    }
  }

  // Предупреждение с обратным отсчётом, пока машина лежит на крыше.
  private updateFlipWarning(progress: number): void {
    if (progress <= 0) {
      this.flipText.setText('');
      return;
    }
    const secondsLeft = ((1 - progress) * FLIP_TIME) / 1000;
    this.flipText.setText(`Переворот! ${secondsLeft.toFixed(1)}`);
    this.flipText.setScale(1 + 0.08 * Math.sin(this.time.now / 80));
  }

  // Иконки ящиков: целый / треснул / разбит / потерян (полупрозрачный).
  private updateIcons(states: CrateState[]): void {
    states.forEach((state, i) => {
      const icon = this.icons[i];
      if (state === this.lastStates[i]) {
        return;
      }
      icon.setTexture(ICON_BY_STATE[state]);
      icon.setAlpha(state === 'lost' ? LOST_ICON_ALPHA : 1);
      // Изменилось состояние (кроме нового заезда) — иконка «вздрагивает».
      if (state !== 'intact') {
        this.tweens.add({ targets: icon, scale: { from: 1.6, to: 1 }, duration: 350, ease: 'Back.easeOut' });
      }
    });
    this.lastStates = [...states];
  }
}
