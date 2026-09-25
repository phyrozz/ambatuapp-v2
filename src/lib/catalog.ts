export type Sound = {
  id: string;
  name: string;
  file: string;
  category: string;
  color: number;
};

export const games = [
  {
    id: 'ambatutap',
    name: 'AmbatuTap',
    category: 'CLICKER',
    description: 'Tap into your chaotic energy. Keep the combo alive.',
    image: '/assets/ambatutap_header.jpg',
    color: 'peach',
    tag: 'QUICK PLAY',
    icon: 'tap',
  },
  {
    id: 'ambatusnake',
    name: 'AmbatuSnake',
    category: 'ARCADE',
    description: 'An old-school classic with a very familiar face.',
    image: '/assets/ambatusnake_header.jpg',
    color: 'green',
    tag: 'FAN FAVORITE',
    icon: 'snake',
  },
  {
    id: 'ambatublou',
    name: 'Ambatublou',
    category: 'PUZZLE',
    description: 'Trust your instincts. Just don’t hit a mine.',
    image: '/assets/ambatublou_header.jpg',
    color: 'lavender',
    tag: 'BRAIN WORKOUT',
    icon: 'mine',
  },
  {
    id: 'flappy-bus',
    name: 'Flappy Bus',
    category: 'ARCADE',
    description: 'A little lift. A lot of near misses. How far can you go?',
    image: '/assets/flappy_bus.png',
    color: 'blue',
    tag: 'ONE MORE TRY',
    icon: 'bird',
  },
] as const;
export type GameId = (typeof games)[number]['id'];
