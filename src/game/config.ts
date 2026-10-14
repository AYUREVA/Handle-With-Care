import Phaser from 'phaser';
import { BackgroundScene } from './BackgroundScene';
import {
  CONSTRAINT_ITERATIONS,
  DEBUG_PHYSICS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRAVITY_Y,
  POSITION_ITERATIONS,
  VELOCITY_ITERATIONS,
} from './constants';
import { GameScene } from './GameScene';
import { UIScene } from './UIScene';

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#2b1b4a',
    title: 'Осторожно, хрупкое!',
    // Порядок сцен = порядок отрисовки: фон, игра, интерфейс поверх.
    scene: [BackgroundScene, GameScene, UIScene],
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: GRAVITY_Y },
        // Физику шагаем сами с фиксированным шагом (см. GameScene.stepPhysics).
        autoUpdate: false,
        // Спящие тела не дрожат в покое.
        enableSleeping: true,
        positionIterations: POSITION_ITERATIONS,
        velocityIterations: VELOCITY_ITERATIONS,
        constraintIterations: CONSTRAINT_ITERATIONS,
        debug: DEBUG_PHYSICS,
      },
    },
    // До трёх касаний одновременно (газ и тормоз двумя пальцами).
    input: {
      activePointers: 3,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  return new Phaser.Game(config);
}
