export const gameCharacters = [
  {
    id: 'dreamy',
    labelKey: 'arcade.characters.dreamy',
    avatar: '/assets/dreamy_face.jpg',
    sprite: '/assets/images/bird_1.png',
    scoreSounds: [
      'audio/score_1.mp3',
      'audio/score_2.mp3',
      'audio/score_3.mp3',
      'audio/score_4.mp3',
      'audio/score_5.mp3',
      'audio/score_6.mp3',
    ],
  },
  {
    id: 'kakangku',
    labelKey: 'arcade.characters.kakangku',
    avatar: '/assets/kakangku.jpg',
    sprite: '/assets/images/bird_2.png',
    scoreSounds: [
      'audio/score_kakangku_1.mp3',
      'audio/score_kakangku_2.mp3',
      'audio/score_kakangku_3.mp3',
    ],
  },
  {
    id: 'nissan',
    labelKey: 'arcade.characters.nissan',
    avatar: '/assets/nissan.jpg',
    sprite: '/assets/images/bird_3.png',
    scoreSounds: [
      'audio/score_nissan_1.mp3',
      'audio/score_nissan_2.mp3',
      'audio/score_nissan_3.mp3',
      'audio/score_nissan_4.mp3',
    ],
  },
  {
    id: 'bunda',
    labelKey: 'arcade.characters.bunda',
    avatar: '/assets/bunda.jpg',
    sprite: '/assets/images/bird_4.png',
    scoreSounds: [
      'audio/score_bunda_1.mp3',
      'audio/score_bunda_2.mp3',
      'audio/score_bunda_3.mp3',
      'audio/score_bunda_4.mp3',
    ],
  },
] as const;

export type GameCharacterId = (typeof gameCharacters)[number]['id'];
export type GameCharacter = (typeof gameCharacters)[number];

export function isGameCharacterId(value: unknown): value is GameCharacterId {
  return gameCharacters.some((character) => character.id === value);
}

export function getGameCharacter(id: GameCharacterId): GameCharacter {
  return gameCharacters.find((character) => character.id === id) ?? gameCharacters[0];
}
