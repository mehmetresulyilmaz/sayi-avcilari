/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  XCircle,
  BrainCircuit,
  Star,
  User,
  Coins,
  Medal,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Settings,
  Map as MapIcon,
  Tent,
  Mountain,
  Snowflake,
  Sun
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AvatarConfig, Operation, Level, UserStats } from './types';

type GameState = 'home' | 'avatar-creation' | 'map' | 'story-intro' | 'playing' | 'story-outro' | 'won' | 'quick-play-levels';

const LEVELS: Level[] = [
  {
    id: 'addition',
    title: 'Toplama Ormanı',
    description: 'Ağaçların arasındaki gizli sayıları topla!',
    icon: 'Tent',
    color: '#A3A380',
    storyIntro: 'Bilgelik Kristali macerasına hoş geldin! İlk durağımız Toplama Ormanı. Buradaki ağaçlar sadece doğru toplamları bulursan sana yol verir.',
    storyOutro: 'Harika! Ormanın ruhu senin zekandan etkilendi ve sana ilk anahtarı verdi.'
  },
  {
    id: 'subtraction',
    title: 'Çıkarma Çölü',
    description: 'Kum fırtınalarından kaçmak için sayıları eksilt!',
    icon: 'Sun',
    color: '#D6CE93',
    storyIntro: 'Sıcak ve kumlu Çıkarma Çölü\'ne geldin. Serapları görmemek için sayıları birbirinden doğru çıkarmalısın.',
    storyOutro: 'Çölün susuzluğunu zekanla yendin! İkinci anahtar artık senin.'
  },
  {
    id: 'multiplication',
    title: 'Çarpma Dağları',
    description: 'Zirveye ulaşmak için sayıları katla!',
    icon: 'Mountain',
    color: '#5A5A40',
    storyIntro: 'Yüksek ve dik Çarpma Dağları seni bekliyor. Her adımda sayıları katlayarak zirveye tırmanmalısın.',
    storyOutro: 'Zirveye ulaştın! Manzara harika ve üçüncü anahtar ellerinde parlıyor.'
  },
  {
    id: 'division',
    title: 'Bölme Buzulu',
    description: 'Buzları eritmek için sayıları paylaştır!',
    icon: 'Snowflake',
    color: '#8E9299',
    storyIntro: 'Son durak: Bölme Buzulu. Buradaki dev buz kütlelerini sadece sayıları eşit parçalara bölerek eritebilirsin.',
    storyOutro: 'Buzlar eridi! Bilgelik Kristali artık senin! Köyünü kurtardın kahraman!'
  }
];

const QUICK_LEVELS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  difficulty: i + 1,
  title: `Seviye ${i + 1}`,
  op: (['addition', 'subtraction', 'multiplication', 'division'] as const)[i % 4]
}));

interface Problem {
  id: number;
  question: string;
  answer: number;
  options: number[];
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('home');
  const [currentLevelId, setCurrentLevelId] = useState<Operation>('addition');
  const [isQuickPlay, setIsQuickPlay] = useState(false);
  const [quickLevel, setQuickLevel] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [stats, setStats] = useState<UserStats>({
    coins: 0,
    badges: [],
    completedLevels: []
  });

  const [avatar, setAvatar] = useState<AvatarConfig>({
    skinColor: '#FFDBAC',
    hairStyle: 'short',
    hairColor: '#4B2C20',
    outfitColor: '#5A5A40',
    accessory: 'none'
  });

  const [isMuted, setIsMuted] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (!isMuted && gameState !== 'home') {
        audioRef.current.play().catch(() => {
          // Autoplay might be blocked until user interaction
          console.log("Autoplay blocked");
        });
      }
    }
  }, [isMuted, gameState]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current && isMuted) {
      audioRef.current.play().catch(() => {});
    }
  };

  const currentLevel = useMemo(() => LEVELS.find(l => l.id === currentLevelId)!, [currentLevelId]);

  const generateProblem = useCallback((op: Operation, id: number, difficulty: number = 1): Problem => {
    let a, b, answer;
    const factor = difficulty * 5;
    
    switch (op) {
      case 'addition':
        a = Math.floor(Math.random() * (10 + factor)) + 1;
        b = Math.floor(Math.random() * (10 + factor)) + 1;
        answer = a + b;
        break;
      case 'subtraction':
        a = Math.floor(Math.random() * (20 + factor)) + 10;
        b = Math.floor(Math.random() * a) + 1;
        answer = a - b;
        break;
      case 'multiplication':
        const maxMult = Math.min(12, 3 + difficulty);
        a = Math.floor(Math.random() * maxMult) + 2;
        b = Math.floor(Math.random() * maxMult) + 2;
        answer = a * b;
        break;
      case 'division':
        const maxDiv = Math.min(10, 2 + difficulty);
        b = Math.floor(Math.random() * maxDiv) + 2;
        answer = Math.floor(Math.random() * maxDiv) + 1;
        a = b * answer;
        break;
    }

    const options = new Set<number>([answer]);
    while (options.size < 4) {
      const offset = Math.floor(Math.random() * 10) - 5;
      const fake = Math.max(0, answer + (offset === 0 ? 3 : offset));
      options.add(fake);
    }

    const opSymbol = op === 'addition' ? '+' : op === 'subtraction' ? '-' : op === 'multiplication' ? '×' : '÷';

    return {
      id,
      question: `${a} ${opSymbol} ${b} = ?`,
      answer,
      options: Array.from(options).sort(() => Math.random() - 0.5)
    };
  }, []);

  const startLevel = (levelId: Operation) => {
    const newProblems = Array.from({ length: 5 }, (_, i) => generateProblem(levelId, i));
    setProblems(newProblems);
    setCurrentLevelId(levelId);
    setCurrentStep(0);
    setIsQuickPlay(false);
    setGameState('story-intro');
    setFeedback(null);
  };

  const startQuickLevel = (levelNum: number) => {
    const levelData = QUICK_LEVELS.find(l => l.id === levelNum)!;
    const newProblems = Array.from({ length: 5 }, (_, i) => generateProblem(levelData.op, i, levelData.difficulty));
    setProblems(newProblems);
    setQuickLevel(levelNum);
    setCurrentStep(0);
    setIsQuickPlay(true);
    setGameState('playing');
    setFeedback(null);
  };

  const handleAnswer = (selected: number) => {
    const currentProblem = problems[currentStep];
    if (selected === currentProblem.answer) {
      setFeedback('correct');
      setStats(prev => ({ ...prev, coins: prev.coins + 10 }));
      
      setTimeout(() => {
        if (currentStep + 1 >= problems.length) {
          if (isQuickPlay) {
            setGameState('quick-play-levels');
            confetti({ particleCount: 50, spread: 60 });
          } else {
            setGameState('story-outro');
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: [currentLevel.color, '#FFFFFF']
            });
          }
        } else {
          setCurrentStep(s => s + 1);
          setFeedback(null);
        }
      }, 800);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback(null), 800);
    }
  };

  const completeLevel = () => {
    setStats(prev => ({
      ...prev,
      completedLevels: [...new Set([...prev.completedLevels, currentLevelId])],
      badges: [...new Set([...prev.badges, `${currentLevelId}_master`])]
    }));
    setGameState('map');
  };

  // Avatar Component
  const AvatarDisplay = ({ config, size = 'md' }: { config: AvatarConfig, size?: 'sm' | 'md' | 'lg' }) => {
    const s = size === 'sm' ? 'w-12 h-12' : size === 'md' ? 'w-32 h-32' : 'w-48 h-48';
    return (
      <div className={`${s} relative mx-auto bg-white rounded-full border-4 border-[#5A5A40]/10 overflow-hidden shadow-inner`}>
        {/* Body */}
        <div className="absolute inset-0 flex flex-col items-center justify-end">
          <div className="w-3/4 h-1/2 rounded-t-full" style={{ backgroundColor: config.outfitColor }} />
        </div>
        {/* Head */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-1/2 h-1/2 rounded-full shadow-sm" style={{ backgroundColor: config.skinColor }}>
          {/* Eyes */}
          <div className="absolute top-1/3 left-1/4 w-2 h-2 bg-[#2D2D2A] rounded-full" />
          <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-[#2D2D2A] rounded-full" />
          {/* Mouth */}
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#2D2D2A]/20 rounded-full" />
        </div>
        {/* Hair */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-1/2 h-1/3 overflow-visible">
          {config.hairStyle === 'short' && (
            <div className="absolute -top-2 left-0 right-0 h-full rounded-t-full" style={{ backgroundColor: config.hairColor }} />
          )}
          {config.hairStyle === 'spiky' && (
            <div className="absolute -top-4 left-0 right-0 h-full flex justify-around">
              {[1,2,3].map(i => <div key={i} className="w-4 h-8 rotate-45" style={{ backgroundColor: config.hairColor }} />)}
            </div>
          )}
          {config.hairStyle === 'long' && (
            <div className="absolute -top-2 -left-2 -right-2 h-16 rounded-t-3xl" style={{ backgroundColor: config.hairColor }} />
          )}
          {config.hairStyle === 'curly' && (
            <div className="absolute -top-4 -left-2 -right-2 h-12 flex flex-wrap justify-center gap-1">
              {[1,2,3,4,5].map(i => <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: config.hairColor }} />)}
            </div>
          )}
        </div>
        {/* Accessory */}
        {config.accessory === 'glasses' && (
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-3/4 flex justify-between px-2">
             <div className="w-4 h-4 border-2 border-[#2D2D2A] rounded-full" />
             <div className="w-4 h-4 border-2 border-[#2D2D2A] rounded-full" />
          </div>
        )}
        {config.accessory === 'hat' && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-8 bg-red-500 rounded-t-full border-b-4 border-red-700" />
        )}
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-between py-6 px-4 font-sans bg-[#F5F5F0] overflow-hidden relative">
      {/* Header Stats */}
      {gameState !== 'home' && (
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <button onClick={() => setGameState('home')} className="p-2 bg-white rounded-full shadow-sm border border-[#5A5A40]/10 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-5 h-5 text-[#5A5A40]" />
            </button>
            <AvatarDisplay config={avatar} size="sm" />
            <div className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-[#5A5A40]/10">
              <span className="text-[10px] font-bold text-[#A3A380] block uppercase leading-none mb-1">Altın</span>
              <div className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-yellow-500" />
                <span className="font-bold text-sm text-[#5A5A40]">{stats.coins}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 pointer-events-auto items-center">
            <button 
              onClick={toggleMute}
              className="p-2 bg-white rounded-full shadow-sm border border-[#5A5A40]/10 hover:bg-gray-50 transition-colors mr-2"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#5A5A40]" />}
            </button>
            {stats.badges.map((b, i) => (
              <div key={i} className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-[#5A5A40]/10">
                <Medal className="w-4 h-4 text-[#5A5A40]" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 w-full flex items-center justify-center overflow-hidden pt-12">
        <AnimatePresence mode="wait">
          {gameState === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="max-w-md w-full text-center space-y-6"
            >
              <div className="space-y-3">
                <div className="w-20 h-20 bg-white rounded-[28px] shadow-xl mx-auto flex items-center justify-center border-2 border-[#5A5A40]/10">
                  <BrainCircuit className="w-10 h-10 text-[#5A5A40]" />
                </div>
                <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#2D2D2A]">Sayı Avcıları</h1>
                <p className="text-[#5A5A40] text-sm font-medium">Matematik hiç bu kadar eğlenceli olmamıştı!</p>
              </div>

              <div className="space-y-3 pt-4">
                <button 
                  onClick={() => {
                    setGameState('avatar-creation');
                    if (!isMuted && audioRef.current) audioRef.current.play().catch(() => {});
                  }}
                  className="w-full py-4 bg-[#5A5A40] text-white rounded-[20px] font-bold text-lg shadow-lg hover:bg-[#4A4A35] transition-all flex items-center justify-center gap-3 group"
                >
                  <MapIcon className="w-5 h-5" />
                  Hikaye Modu
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button 
                  onClick={() => {
                    setGameState('quick-play-levels');
                    if (!isMuted && audioRef.current) audioRef.current.play().catch(() => {});
                  }}
                  className="w-full py-4 bg-white text-[#5A5A40] border-2 border-[#5A5A40]/10 rounded-[20px] font-bold text-lg shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
                >
                  <RotateCcw className="w-5 h-5" />
                  Hızlı Antrenman
                </button>

                <button 
                  onClick={() => {
                    if (!isMuted && audioRef.current) audioRef.current.play().catch(() => {});
                    window.location.reload();
                  }}
                  className="w-full py-2 text-[#5A5A40]/60 text-sm font-bold hover:text-[#5A5A40] transition-colors"
                >
                  Oyundan Çık
                </button>
                
                <div className="pt-4 flex justify-center">
                  <button 
                    onClick={toggleMute}
                    className="flex items-center gap-2 text-[#5A5A40]/60 hover:text-[#5A5A40] transition-colors text-xs font-bold"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    Müzik: {isMuted ? 'Kapalı' : 'Açık'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'quick-play-levels' && (
            <motion.div 
              key="quick-play"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-2xl w-full space-y-6"
            >
              <div className="text-center">
                <h2 className="font-serif text-2xl font-bold text-[#2D2D2A]">Hızlı Antrenman</h2>
                <p className="text-sm text-[#5A5A40]">Seviyeni seç ve yeteneklerini geliştir!</p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
                {QUICK_LEVELS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => startQuickLevel(l.id)}
                    className="aspect-square bg-white rounded-2xl shadow-sm border border-[#5A5A40]/10 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-transform"
                  >
                    <span className="text-xl font-bold text-[#5A5A40]">{l.id}</span>
                    <span className="text-[8px] uppercase font-bold text-[#A3A380] text-center px-1">
                      {l.op === 'addition' ? 'Toplama' : l.op === 'subtraction' ? 'Çıkarma' : l.op === 'multiplication' ? 'Çarpma' : 'Bölme'}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {gameState === 'avatar-creation' && (
            <motion.div 
              key="avatar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl w-full bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-[#5A5A40]/10 overflow-y-auto max-h-[85vh] scrollbar-hide"
            >
              <h1 className="font-serif text-2xl font-bold mb-6 text-center text-[#2D2D2A]">Kahramanını Yarat</h1>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <AvatarDisplay config={avatar} size="md" />
                  <div className="flex justify-center gap-2">
                    {['#FFDBAC', '#F1C27D', '#E0AC69', '#8D5524'].map(c => (
                      <button 
                        key={c}
                        onClick={() => setAvatar(a => ({ ...a, skinColor: c }))}
                        className={`w-6 h-6 rounded-full border-2 ${avatar.skinColor === c ? 'border-[#5A5A40]' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-[#A3A380] uppercase mb-1.5 block">Saç Stili</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['short', 'long', 'curly', 'spiky'] as const).map(s => (
                        <button 
                          key={s}
                          onClick={() => setAvatar(a => ({ ...a, hairStyle: s }))}
                          className={`py-1.5 px-3 rounded-lg border-2 text-sm transition-all ${avatar.hairStyle === s ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-[#F5F5F0] border-transparent text-[#5A5A40]'}`}
                        >
                          {s === 'short' ? 'Kısa' : s === 'long' ? 'Uzun' : s === 'curly' ? 'Kıvırcık' : 'Diken'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#A3A380] uppercase mb-1.5 block">Kıyafet Rengi</label>
                    <div className="flex gap-2">
                      {['#5A5A40', '#A3A380', '#E07A5F', '#3D405B', '#81B29A'].map(c => (
                        <button 
                          key={c}
                          onClick={() => setAvatar(a => ({ ...a, outfitColor: c }))}
                          className={`w-6 h-6 rounded-full border-2 ${avatar.outfitColor === c ? 'border-black' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#A3A380] uppercase mb-1.5 block">Aksesuar</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['none', 'glasses', 'hat', 'scarf'] as const).map(acc => (
                        <button 
                          key={acc}
                          onClick={() => setAvatar(a => ({ ...a, accessory: acc }))}
                          className={`py-1.5 px-3 rounded-lg border-2 text-sm transition-all ${avatar.accessory === acc ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-[#F5F5F0] border-transparent text-[#5A5A40]'}`}
                        >
                          {acc === 'none' ? 'Yok' : acc === 'glasses' ? 'Gözlük' : acc === 'hat' ? 'Şapka' : 'Atkı'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => setGameState('map')}
                    className="w-full py-3 bg-[#5A5A40] text-white rounded-xl font-bold shadow-lg hover:bg-[#4A4A35] transition-all flex items-center justify-center gap-2 group mt-2"
                  >
                    Maceraya Başla
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'map' && (
            <motion.div 
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl w-full px-2"
            >
              <div className="text-center mb-8">
                <h2 className="font-serif text-3xl font-bold text-[#2D2D2A] mb-1">Dünya Haritası</h2>
                <p className="text-sm text-[#5A5A40]">Bilgelik Kristali'ne giden yolu seç!</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {LEVELS.map((level, idx) => {
                  const isCompleted = stats.completedLevels.includes(level.id);
                  const isLocked = idx > 0 && !stats.completedLevels.includes(LEVELS[idx-1].id);
                  
                  return (
                    <motion.button
                      key={level.id}
                      whileHover={!isLocked ? { y: -5 } : {}}
                      onClick={() => !isLocked && startLevel(level.id)}
                      disabled={isLocked}
                      className={`
                        relative p-5 rounded-[24px] text-left transition-all h-48 flex flex-col justify-between
                        ${isLocked ? 'bg-gray-200 opacity-50 grayscale cursor-not-allowed' : 'bg-white shadow-xl border border-[#5A5A40]/10'}
                      `}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: level.color + '20' }}>
                        {level.id === 'addition' && <Tent className="w-5 h-5" style={{ color: level.color }} />}
                        {level.id === 'subtraction' && <Sun className="w-5 h-5" style={{ color: level.color }} />}
                        {level.id === 'multiplication' && <Mountain className="w-5 h-5" style={{ color: level.color }} />}
                        {level.id === 'division' && <Snowflake className="w-5 h-5" style={{ color: level.color }} />}
                      </div>
                      <div>
                        <h3 className="font-serif text-lg font-bold text-[#2D2D2A] mb-0.5 leading-tight">{level.title}</h3>
                        <p className="text-[10px] text-[#5A5A40] leading-tight line-clamp-2">{level.description}</p>
                      </div>
                      {isCompleted && (
                        <div className="absolute top-3 right-3 text-green-500">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {(gameState === 'story-intro' || gameState === 'story-outro') && (
            <motion.div 
              key="story"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-2xl border border-[#5A5A40]/10 text-center"
            >
              <AvatarDisplay config={avatar} size="md" />
              <div className="mt-6 mb-8">
                <h3 className="font-serif text-xl font-bold text-[#2D2D2A] mb-3">
                  {gameState === 'story-intro' ? 'Yeni Bölüm!' : 'Tebrikler!'}
                </h3>
                <p className="text-sm text-[#5A5A40] leading-relaxed italic">
                  "{gameState === 'story-intro' ? currentLevel.storyIntro : currentLevel.storyOutro}"
                </p>
              </div>
              <button 
                onClick={() => gameState === 'story-intro' ? setGameState('playing') : completeLevel()}
                className="w-full py-3.5 bg-[#5A5A40] text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {gameState === 'story-intro' ? 'Hadi Başlayalım!' : 'Haritaya Dön'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-xl flex flex-col items-center"
            >
              {/* Responsive Progress Bar */}
              <div className="w-full flex justify-between items-center mb-6 gap-4 px-2">
                <div className="flex gap-1.5 justify-center">
                  {problems.map((_, i) => (
                    <div 
                      key={i}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                        ${i === currentStep ? 'bg-[#5A5A40] text-white scale-110 shadow-md' : i < currentStep ? 'bg-green-500 text-white' : 'bg-white text-[#5A5A40] border border-[#5A5A40]/10'}
                      `}
                    >
                      {i < currentStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                  ))}
                </div>
                <div className="bg-white px-3 py-1.5 rounded-full border border-[#5A5A40]/10 flex items-center gap-2 shadow-sm">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-xs text-[#5A5A40] whitespace-nowrap">{isQuickPlay ? `Seviye ${quickLevel}` : currentLevel.title}</span>
                </div>
              </div>

              {/* Question Card */}
              <div className="w-full bg-white rounded-[32px] p-6 sm:p-10 shadow-2xl border border-[#5A5A40]/10 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -30, opacity: 0 }}
                    className="text-center"
                  >
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#A3A380] mb-3 block">
                      Soru {currentStep + 1} / {problems.length}
                    </span>
                    <h2 className="font-serif text-4xl sm:text-5xl font-bold text-[#2D2D2A] mb-8">
                      {problems[currentStep].question}
                    </h2>

                    <div className="grid grid-cols-2 gap-3">
                      {problems[currentStep].options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAnswer(opt)}
                          disabled={feedback !== null}
                          className={`
                            py-4 px-4 rounded-2xl text-lg sm:text-xl font-bold transition-all duration-300
                            ${feedback === null ? 'bg-[#F5F5F0] hover:bg-[#EFEBCE] text-[#5A5A40] hover:scale-[1.02]' : ''}
                            ${feedback === 'correct' && opt === problems[currentStep].answer ? 'bg-green-500 text-white scale-105' : ''}
                            ${feedback === 'wrong' && opt !== problems[currentStep].answer ? 'opacity-50' : ''}
                            ${feedback === 'wrong' && opt === problems[currentStep].answer ? 'bg-green-100 text-green-700' : ''}
                          `}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Feedback Overlay */}
                <AnimatePresence>
                  {feedback && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.2 }}
                      className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10"
                    >
                      {feedback === 'correct' ? (
                        <div className="flex flex-col items-center text-green-500">
                          <CheckCircle2 className="w-16 h-16 mb-2" />
                          <span className="text-lg font-bold font-serif italic">Harika! +10 Altın</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-red-400">
                          <XCircle className="w-16 h-16 mb-2" />
                          <span className="text-lg font-bold font-serif italic">Tekrar Dene!</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Background Elements */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-20">
        <div className="absolute top-10 left-10 w-64 h-64 bg-[#A3A380] rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#D6CE93] rounded-full blur-3xl" />
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-[#5A5A40]/60 text-[10px] mt-auto">
        <p>
          Created by{' '}
          <a 
            href="https://fuzulimedya.netlify.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-bold hover:text-[#5A5A40] transition-colors underline underline-offset-4"
          >
            Fuzuli Medya
          </a>
        </p>
      </footer>
    </div>
  );
}
