export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division';

export interface AvatarConfig {
  skinColor: string;
  hairStyle: 'short' | 'long' | 'curly' | 'spiky';
  hairColor: string;
  outfitColor: string;
  accessory: 'none' | 'glasses' | 'hat' | 'scarf';
}

export interface Level {
  id: Operation;
  title: string;
  description: string;
  icon: string;
  color: string;
  storyIntro: string;
  storyOutro: string;
}

export interface UserStats {
  coins: number;
  badges: string[];
  completedLevels: Operation[];
  unlockedItems: string[];
}
