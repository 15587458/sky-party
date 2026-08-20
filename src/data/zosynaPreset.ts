import { Chart, ChartElement } from '../types';

export const ZOSYNA_CHART_ID = 'chart-zosyna';
export const ZOSYNA_CHART_NAME = 'Зосина';

export const ZOSYNA_ELEMENTS: ChartElement[] = [
  // 1. СЦЕНА (Stage)
  {
    id: 'stage-main',
    type: 'shape',
    x: 340,
    y: 20,
    width: 320,
    height: 110,
    label: 'СЦЕНА',
    priceType: 'standard',
    fill: '#27272a'
  },

  // 2. ФАН-ЗОНА (Fan-Zone) - Purple Standard Zone
  {
    id: 'fanzone-main',
    type: 'fanzone',
    x: 290,
    y: 155,
    width: 420,
    height: 250,
    label: 'ФАН-ЗОНА',
    priceType: 'standard',
    capacity: 150,
    fill: '#9333ea'
  },

  // 3. ЛІВИЙ СЕКТОР СТОЛІВ (Всі столи VIP - Жовті, № 1 - 6)
  {
    id: 'table-1',
    type: 'table',
    x: 240,
    y: 130,
    radius: 24,
    width: 48,
    height: 48,
    label: 'Стіл 1',
    seatsCount: 4,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-2',
    type: 'table',
    x: 125,
    y: 130,
    width: 60,
    height: 40,
    label: 'Стіл 2',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-3',
    type: 'table',
    x: 110,
    y: 215,
    width: 60,
    height: 40,
    label: 'Стіл 3',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-4',
    type: 'table',
    x: 175,
    y: 215,
    width: 60,
    height: 40,
    label: 'Стіл 4',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-5',
    type: 'table',
    x: 80,
    y: 310,
    width: 60,
    height: 40,
    label: 'Стіл 5',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-6',
    type: 'table',
    x: 150,
    y: 310,
    width: 45,
    height: 40,
    label: 'Стіл 6',
    seatsCount: 4,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },

  // 4. НИЖНІЙ РЯД СТОЛІВ (Всі столи VIP - Жовті, № 7 - 14)
  {
    id: 'table-7',
    type: 'table',
    x: 65,
    y: 430,
    width: 60,
    height: 40,
    label: 'Стіл 7',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-8',
    type: 'table',
    x: 140,
    y: 430,
    width: 60,
    height: 40,
    label: 'Стіл 8',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-9',
    type: 'table',
    x: 215,
    y: 430,
    width: 55,
    height: 40,
    label: 'Стіл 9',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-10',
    type: 'table',
    x: 275,
    y: 430,
    width: 55,
    height: 40,
    label: 'Стіл 10',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-11',
    type: 'table',
    x: 335,
    y: 430,
    width: 55,
    height: 40,
    label: 'Стіл 11',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-12',
    type: 'table',
    x: 395,
    y: 430,
    width: 55,
    height: 40,
    label: 'Стіл 12',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-13',
    type: 'table',
    x: 455,
    y: 430,
    width: 55,
    height: 40,
    label: 'Стіл 13',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-14',
    type: 'table',
    x: 515,
    y: 430,
    width: 55,
    height: 40,
    label: 'Стіл 14',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },

  // 5. ПРАВИЙ СЕКТОР СТОЛІВ (Всі столи VIP - Жовті, № 15 - 28)
  {
    id: 'table-15',
    type: 'table',
    x: 760,
    y: 120,
    width: 55,
    height: 38,
    label: 'Стіл 15',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-16',
    type: 'table',
    x: 825,
    y: 120,
    width: 55,
    height: 38,
    label: 'Стіл 16',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-17',
    type: 'table',
    x: 890,
    y: 120,
    width: 55,
    height: 38,
    label: 'Стіл 17',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-18',
    type: 'table',
    x: 710,
    y: 195,
    width: 50,
    height: 42,
    label: 'Стіл 18',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-19',
    type: 'table',
    x: 770,
    y: 195,
    width: 50,
    height: 42,
    label: 'Стіл 19',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-20',
    type: 'table',
    x: 830,
    y: 195,
    width: 50,
    height: 42,
    label: 'Стіл 20',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-21',
    type: 'table',
    x: 890,
    y: 195,
    width: 50,
    height: 42,
    label: 'Стіл 21',
    seatsCount: 4,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-22',
    type: 'table',
    x: 730,
    y: 280,
    radius: 22,
    width: 44,
    height: 44,
    label: 'Стіл 22',
    seatsCount: 5,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-23',
    type: 'table',
    x: 900,
    y: 260,
    width: 45,
    height: 38,
    label: 'Стіл 23',
    seatsCount: 4,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-24',
    type: 'table',
    x: 910,
    y: 330,
    width: 60,
    height: 40,
    label: 'Стіл 24',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-25',
    type: 'table',
    x: 730,
    y: 360,
    width: 50,
    height: 40,
    label: 'Стіл 25',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-26',
    type: 'table',
    x: 795,
    y: 360,
    width: 50,
    height: 40,
    label: 'Стіл 26',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-27',
    type: 'table',
    x: 865,
    y: 360,
    width: 40,
    height: 40,
    label: 'Стіл 27',
    seatsCount: 4,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },
  {
    id: 'table-28',
    type: 'table',
    x: 930,
    y: 420,
    width: 60,
    height: 38,
    label: 'Стіл 28',
    seatsCount: 6,
    sellAsWhole: true,
    priceType: 'vip',
    fill: '#eab308'
  },

  // 6. ВХІД (Entrance)
  {
    id: 'entrance-shape',
    type: 'shape',
    x: 700,
    y: 300,
    width: 25,
    height: 45,
    label: 'ВХІД',
    priceType: 'standard',
    fill: '#ca8a04'
  },
  {
    id: 'text-vhid',
    type: 'text',
    x: 708,
    y: 312,
    rotation: 90,
    label: 'ВХІД',
    priceType: 'standard',
    radius: 12
  }
];

export const ZOSYNA_PRESET_CHART: Chart = {
  id: ZOSYNA_CHART_ID,
  name: ZOSYNA_CHART_NAME,
  elementsCount: ZOSYNA_ELEMENTS.length,
  territory: {
    width: 1200,
    height: 800,
    venueType: 'club',
    floorColor: '#d4d4d8',
    floorMaterial: 'concrete',
    wallColor: '#334155',
    wallHeight: 16,
    wallVisible: true,
    lightingPreset: 'neon_club',
    showGrid: true,
    name: 'Зал Зосина'
  },
  createdAt: 1700000000000
};

