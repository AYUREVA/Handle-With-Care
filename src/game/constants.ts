// Все параметры игры «Осторожно, хрупкое!» в одном месте.
//
// Единицы Matter.js: расстояния — в пикселях, скорости — в пикселях за шаг
// физики (1 шаг = 1/60 секунды), угловые скорости — в радианах за шаг.
// Силы и моменты в Matter очень маленькие числа — это нормально.

// ===== Экран =====

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

// ===== Физический мир =====

// Длительность одного шага физики (мс). Физика всегда шагает ровно так,
// независимо от частоты монитора, — поэтому игра одинакова на 60 и 144 Гц.
export const PHYSICS_STEP_MS = 1000 / 60;
// Скорость игры: 1 — обычная, меньше — всё чуть замедленно и плавнее
// (прыжки, удары, покачивание). Траектории при этом не меняются.
export const GAME_SPEED = 0.85;
// Сколько шагов физики максимум можно сделать за один кадр (если кадр
// «подвис»). Больше — точнее догоняет, но может ещё сильнее тормозить.
export const MAX_PHYSICS_STEPS_PER_FRAME = 4;
// Сила тяжести (1 — стандарт Matter). Больше — машина «тяжелее»,
// короче прыжки и жёстче приземления.
export const GRAVITY_Y = 1;
// Точность решателя. Больше — меньше проваливаний и дрожания, но медленнее.
export const POSITION_ITERATIONS = 10;
export const VELOCITY_ITERATIONS = 8;
export const CONSTRAINT_ITERATIONS = 4;
// Включить отрисовку физических тел (для отладки).
export const DEBUG_PHYSICS = false;

// ===== Трасса =====

// Сколько пикселей в одном «метре» счёта.
export const PIXELS_PER_METER = 32;
// Высота земли (Y) на старте.
export const GROUND_BASE_Y = 480;
// Ширина одного отрезка земли. Меньше — плавнее холмы, но больше тел.
export const SEGMENT_WIDTH = 24;
// Толщина земли под поверхностью. Толстая земля — защита от проваливания.
export const GROUND_THICKNESS = 180;
// Ширина куска трассы, который создаётся и удаляется целиком.
export const CHUNK_WIDTH = SEGMENT_WIDTH * 40;
// Сколько кусков держать позади и впереди машины.
export const CHUNKS_BEHIND = 2;
export const CHUNKS_AHEAD = 2;
// Ровная площадка в начале трассы (px) и длина плавного перехода к холмам.
export const START_FLAT_LENGTH = 700;
export const START_BLEND_LENGTH = 900;
// На каком расстоянии от старта холмы достигают полной высоты (px).
// Меньше — игра быстрее становится сложной.
export const HILL_RAMP_DISTANCE = 16000;
// Высота холмов в самом начале (доля от полной высоты).
export const HILL_START_SCALE = 0.35;
// Слои холмов: сумма синусов. wavelength — длина волны (px), amplitude —
// высота (px). rampStart — с какого расстояния слой начинает появляться
// (мелкие кочки приходят позже). Крутизна слоя ≈ amplitude * 2π / wavelength.
// Сумма крутизны всех слоёв ≈ 1.1 (около 48°) — так круто бывает редко,
// только когда склоны слоёв совпадают.
export const HILL_LAYERS = [
  { wavelength: 2600, amplitude: 165, rampStart: 0 },
  { wavelength: 1100, amplitude: 62, rampStart: 0 },
  { wavelength: 520, amplitude: 20, rampStart: 2500 },
  { wavelength: 230, amplitude: 5.5, rampStart: 7000 },
];
// Seed трассы. null — новая трасса каждую игру; строка — всегда одна и та же.
export const TRACK_SEED: string | null = null;
// Трение земли (колёса цепляются, корпус на крыше скользит меньше).
export const GROUND_FRICTION = 1;
// Вид земли: толщина травы, число полос «градиента» почвы, шаг полос
// и на какую глубину рисовать землю (должна перекрывать низ экрана).
export const GRASS_THICKNESS = 11;
export const SOIL_BANDS = 7;
export const SOIL_BAND_DEPTH = 34;
export const GROUND_VISUAL_DEPTH = 1600;
// Камешки в почве на один кусок трассы.
export const PEBBLES_PER_CHUNK = 26;
// Табличка с расстоянием каждые N метров.
export const MARKER_EVERY_METERS = 100;
// X начала трассы: шлагбаум (назад не проехать) и место старта машины.
export const BARRIER_X = 80;
export const TRUCK_START_X = 300;

// ===== Машина: корпус =====
// Координаты частей корпуса — относительно центра картинки пикапа.

// Длина корпуса.
export const TRUCK_LENGTH = 190;
// Пол кузова: толщина и положение центра по Y.
export const FLOOR_THICKNESS = 16;
export const FLOOR_Y = 14;
// Высота бортиков кузова над полом. Ниже — ящики вылетают легче.
export const BED_WALL_HEIGHT = 13;
// Толщина заднего бортика.
export const BED_WALL_THICKNESS = 8;
// Кабина: от задней стенки до лобового стекла, высота над полом.
export const CAB_BACK_X = 6;
export const CAB_FRONT_X = 66;
export const CAB_HEIGHT = 50;
// Капот: высота над полом.
export const HOOD_HEIGHT = 22;
// Плотность корпуса. Тяжелее корпус — устойчивее машина, ящики относительно легче.
export const CHASSIS_DENSITY = 0.002;
// Трение корпуса (когда он трётся о землю или ящики).
export const CHASSIS_FRICTION = 0.6;
// Сопротивление воздуха корпусу (замедляет в полёте и на ходу).
export const CHASSIS_AIR_FRICTION = 0.004;

// ===== Машина: колёса и подвеска =====

export const WHEEL_RADIUS = 19;
// Сколько граней у колеса. В Matter «круг» — это многоугольник, и
// по умолчанию у такого колеса всего 19 граней: катясь, оно стучит
// углами по земле и мелко дребезжит. Больше граней — круглее колесо.
export const WHEEL_SIDES = 64;
// Сглаживание картинки колеса относительно корпуса (мс). Убирает
// оставшуюся мелкую дрожь колёс, но не мешает видеть ход подвески.
// 0 — без сглаживания.
export const WHEEL_VISUAL_SMOOTHING = 25;
// Положение осей относительно центра пикапа (при подвеске в покое).
export const WHEEL_OFFSET_X = 63;
export const WHEEL_OFFSET_Y = 40;
export const WHEEL_DENSITY = 0.003;
// Трение шин. Выше — лучше цепляются за склон.
export const WHEEL_FRICTION = 1;
export const WHEEL_FRICTION_STATIC = 10;
// Сопротивление качению: меньше — машина дольше катится накатом.
export const WHEEL_AIR_FRICTION = 0.003;
// Подвеска как у Hill Climb: колесо держит жёсткий рычаг (не даёт колесу
// уйти вперёд-назад), а вверх-вниз его держит мягкая пружина.
// Длина рычага: от оси к центру машины.
export const ARM_LENGTH = 46;
// Жёсткость пружины (0..1). Меньше — мягче, сильнее раскачка и крен.
export const SUSPENSION_STIFFNESS = 0.02;
// Демпфирование (амортизатор, 0..1). Меньше — машина дольше качается
// после кочки; больше — гасит покачивание быстрее.
export const SUSPENSION_DAMPING = 0.06;
// Ход подвески вверх (сжатие) и вниз (отбой) в пикселях. За пределами
// хода включается «отбойник» — пружина резко становится жёсткой.
export const SUSPENSION_TRAVEL_UP = 13;
export const SUSPENSION_TRAVEL_DOWN = 10;
export const BUMP_STOP_STIFFNESS = 0.4;
// Насколько пружина в покое длиннее, чем при сборке: компенсирует
// просадку под весом машины (иначе машина «садится» на отбойники).
export const SPRING_PRELOAD = 7;

// ===== Машина: привод и управление =====

// Момент на каждое колесо при полном газе. Больше — резче разгон и
// выше подъёмы.
export const DRIVE_TORQUE = 0.32;
// Максимальная скорость вращения колёс вперёд (рад/шаг). Ближе к ней
// мотор плавно слабеет — так ограничивается скорость машины без рывков.
export const MAX_WHEEL_SPIN = 0.72;
// Тормоз: момент и скорость вращения, ниже которой тормоз плавно
// отпускает (иначе машина дёргается на месте между тормозом и задним ходом).
export const BRAKE_TORQUE = 0.4;
export const BRAKE_SOFT_SPIN = 0.12;
// Задний ход: момент и максимальная скорость вращения колёс.
export const REVERSE_TORQUE = 0.16;
export const MAX_REVERSE_SPIN = 0.3;
// Как быстро педаль газа доходит до конца (доля за шаг физики).
// Больше — резче отклик, меньше — плавнее трогание.
export const THROTTLE_RESPONSE = 0.12;
// Реактивный момент на корпус от мотора (доля от момента колёс).
// На газу нос приподнимается, на тормозе — клюёт. 0 — выключить.
export const DRIVE_REACTION = 0.22;
// Управление в воздухе: прибавка угловой скорости корпуса за шаг
// и её предел. Больше — легче выровнять машину в прыжке.
export const AIR_SPIN_ACCEL = 0.0028;
export const AIR_SPIN_MAX = 0.06;
// Сколько мс после последнего касания колесо ещё считается «на земле».
export const GROUND_CONTACT_GRACE = 90;
// Предел скорости корпуса (px/шаг): защита от проваливания сквозь землю.
export const MAX_SPEED = 20;
// Переворот: угол (градусы), после которого машина считается на крыше,
// и сколько мс она должна так пролежать до поражения.
export const FLIP_ANGLE = 110;
export const FLIP_TIME = 2000;

// ===== Груз =====

export const CRATE_COUNT = 3;
export const CRATE_SIZE = 28;
// Зазор между ящиками при загрузке.
export const CRATE_GAP = 2;
// Плотность ящика. Легче — чаще подпрыгивают в кузове.
export const CRATE_DENSITY = 0.0012;
// Трение ящика: высокое, чтобы ящик не ползал по кузову.
export const CRATE_FRICTION = 0.9;
export const CRATE_FRICTION_STATIC = 1.2;
export const CRATE_AIR_FRICTION = 0.01;
// Отскок ящика (0 — совсем не прыгает, нет дрожания в покое).
export const CRATE_RESTITUTION = 0;
// Сколько шагов покоя до «засыпания» ящика (сон убирает дрожание).
export const CRATE_SLEEP_THRESHOLD = 30;
// Будить ящики, если корпус движется быстрее этого (px/шаг).
export const CRATE_WAKE_SPEED = 0.15;
// Сила удара (скорость сближения по нормали, px/шаг), с которой
// ящик трескается; второй такой удар — ящик разбит.
export const CRATE_CRACK_SPEED = 7.2;
// После удара ящик столько мс «неуязвим» (один удар = одна трещина).
export const CRATE_HIT_COOLDOWN = 350;
// Ящик потерян, если его центр дальше этого от центра кузова.
export const CRATE_LOST_DISTANCE = 120;
// Потерянные ящики удаляются, когда отстали от машины на столько px.
export const CRATE_CLEANUP_DISTANCE = 1400;

// ===== Счёт =====

// Бонус в конце игры за целый и за треснувший ящик.
export const CRATE_BONUS = 50;
export const CRACKED_CRATE_BONUS = 20;
// Ключи рекордов в localStorage: лучший счёт и лучшее расстояние.
export const BEST_SCORE_KEY = 'handle-with-care.best-score';
export const BEST_DISTANCE_KEY = 'handle-with-care.best-distance';
// Пауза между поражением и экраном итогов (мс).
export const RESULTS_DELAY = 900;

// ===== Камера =====

// Плавность следования (0..1). Меньше — плавнее, но камера сильнее отстаёт.
export const CAMERA_LERP_X = 0.12;
export const CAMERA_LERP_Y = 0.08;
// Упреждение: камера смотрит вперёд на скорость * коэффициент (px).
export const CAMERA_LOOKAHEAD = 16;
export const CAMERA_LOOKAHEAD_MAX = 240;
// Камера держит машину чуть ниже центра, чтобы было видно небо и холмы.
export const CAMERA_OFFSET_Y = -70;
// Отдаление на скорости: зум при скорости 0 и на максимальной скорости.
export const CAMERA_ZOOM_SLOW = 1;
export const CAMERA_ZOOM_FAST = 0.8;
export const CAMERA_ZOOM_SPEED = 12;
// Плавность изменения зума.
export const CAMERA_ZOOM_LERP = 0.03;
// Тряска камеры: с какой скорости удара колеса о землю, сила и длительность.
export const LANDING_SHAKE_SPEED = 7;
export const LANDING_SHAKE_INTENSITY = 0.0012;
export const LANDING_SHAKE_MAX = 0.012;
export const LANDING_SHAKE_DURATION = 180;

// ===== Эффекты =====

// Как часто (мс) колесо выбрасывает облачко пыли при газе.
export const DUST_FREQUENCY = 35;
// Минимальная скорость вращения колеса для пыли.
export const DUST_MIN_SPIN = 0.12;
export const DUST_LANDING_BURST = 10;
export const SPLINTERS_CRACK = 6;
export const SPLINTERS_BREAK = 22;

// ===== Параллакс =====
// Коэффициент: какая доля движения камеры передаётся слою (0 — стоит, 1 — как земля).

export const PARALLAX_CLOUDS = 0.04;
export const PARALLAX_MOUNTAINS = 0.1;
export const PARALLAX_HILLS = 0.25;
export const PARALLAX_TREES = 0.5;
// Вертикальный сдвиг слоёв при подъёме/спуске камеры (доля) и его предел.
export const PARALLAX_VERTICAL = 0.15;
export const PARALLAX_VERTICAL_MAX = 90;
// Скорость дрейфа облаков (px/с).
export const CLOUD_DRIFT_SPEED = 6;

// ===== Палитра (закат) =====

export const COLORS = {
  skyTop: '#2b1b4a',
  skyMid: '#a8467a',
  skyLow: '#f4845f',
  skyHorizon: '#ffd38a',
  sun: 0xffe7a8,
  cloud: 0xffc9a8,
  mountainsFar: 0x7a3f74,
  hillsNear: 0x542a5e,
  silhouette: 0x2e1a3d,
  soilTop: 0x8a5a3c,
  soilDeep: 0x3a2117,
  grass: 0x7cb342,
  grassLight: 0xa5d65a,
  outline: 0x24130c,
  truckBody: 0xe94f37,
  truckShade: 0xb8372a,
  truckLight: 0xff7a5c,
  glass: 0x9fd8f0,
  glassShine: 0xe6f7ff,
  chrome: 0xd9dde3,
  headlight: 0xffe680,
  taillight: 0xff3b3b,
  tire: 0x262626,
  rim: 0xc9ced6,
  hub: 0x6b7280,
  wood: 0xd9a066,
  woodDark: 0xa8723d,
  woodOutline: 0x6b4423,
  fragile: 0xc0392b,
  crack: 0x3b2314,
  dust: 0xd8b38a,
  uiText: '#fff4e0',
  uiStroke: '#2b1b4a',
  uiAccent: '#ffd38a',
  uiDanger: '#ff6b5b',
  uiPanel: 0x2b1b4a,
};

// Шрифт интерфейса: системный, без внешних файлов.
export const FONT_FAMILY = '"Arial Black", "Segoe UI", system-ui, sans-serif';
