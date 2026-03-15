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
  User as UserIcon,
  Coins,
  Medal,
  Lock,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Settings,
  Map as MapIcon,
  Tent,
  Mountain,
  Snowflake,
  Sun,
  LogOut,
  LogIn,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AvatarConfig, Operation, Level, UserStats } from './types';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from './firebase';

type GameState = 'home' | 'avatar-creation' | 'map' | 'story-intro' | 'playing' | 'story-outro' | 'won' | 'quick-play-levels' | 'loading' | 'leaderboard';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

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

const QUICK_LEVELS = Array.from({ length: 20 }, (_, i) => ({
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
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [gameState, setGameState] = useState<GameState>('loading');
  const [currentLevelId, setCurrentLevelId] = useState<Operation>('addition');
  const [isQuickPlay, setIsQuickPlay] = useState(false);
  const [quickLevel, setQuickLevel] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [marketMessage, setMarketMessage] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<FirestoreErrorInfo | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  
  const [stats, setStats] = useState<UserStats>(() => {
    const local = localStorage.getItem('guest_stats');
    return local ? JSON.parse(local) : {
      coins: 0,
      badges: [],
      completedLevels: [],
      unlockedItems: ['skin-1', 'skin-2', 'skin-3', 'skin-4', 'hair-short', 'hair-spiky', 'acc-none', 'outfit-1', 'outfit-2', 'outfit-3']
    };
  });

  const [avatar, setAvatar] = useState<AvatarConfig>(() => {
    const local = localStorage.getItem('guest_avatar');
    return local ? JSON.parse(local) : {
      skinColor: '#FFDBAC',
      hairStyle: 'short',
      hairColor: '#4B2C20',
      outfitColor: '#5A5A40',
      accessory: 'none'
    };
  });

  const [isMuted, setIsMuted] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setErrorInfo(errInfo);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) {
        setGameState('home');
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStats(data.stats);
        setAvatar(data.avatar);
        if (gameState === 'loading') setGameState('home');
      } else {
        // Initialize new user data
        const initialData = {
          uid: user.uid,
          email: user.email,
          stats: {
            coins: 0,
            badges: [],
            completedLevels: [],
            unlockedItems: ['skin-1', 'skin-2', 'skin-3', 'skin-4', 'hair-short', 'hair-spiky', 'acc-none', 'outfit-1', 'outfit-2', 'outfit-3']
          },
          avatar: {
            skinColor: '#FFDBAC',
            hairStyle: 'short',
            hairColor: '#4B2C20',
            outfitColor: '#5A5A40',
            accessory: 'none'
          },
          updatedAt: serverTimestamp()
        };
        setDoc(userDocRef, initialData).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
        if (gameState === 'loading') setGameState('home');
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Local Storage Sync for Guests
  useEffect(() => {
    if (!user) {
      localStorage.setItem('guest_stats', JSON.stringify(stats));
      localStorage.setItem('guest_avatar', JSON.stringify(avatar));
    }
  }, [stats, avatar, user]);

  const saveToFirestore = async (newStats: UserStats, newAvatar?: AvatarConfig) => {
    if (!user) return;
    try {
      const currentAvatar = newAvatar || avatar;
      await setDoc(doc(db, 'users', user.uid), {
        stats: newStats,
        avatar: currentAvatar,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update Leaderboard
      await setDoc(doc(db, 'leaderboard', user.uid), {
        displayName: user.displayName || 'İsimsiz Kahraman',
        photoURL: user.photoURL || '',
        coins: newStats.coins,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const q = query(collection(db, 'leaderboard'), orderBy('coins', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => doc.data());
      setLeaderboardData(data);
      setGameState('leaderboard');
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'leaderboard');
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setGameState('home');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.15;

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
      if (!isMuted && gameState !== 'home' && gameState !== 'loading') {
        audioRef.current.play().catch(() => {
          console.log("Autoplay blocked, waiting for interaction");
        });
      }
    }
  }, [isMuted, gameState]);

  // Global click listener to bypass autoplay restrictions
  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current && !isMuted && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
        if (!next) {
          audioRef.current.play().catch(() => {});
        }
      }
      return next;
    });
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
        // Seviye 8'den sonra 2 basamaklı çarpmalar başlasın
        const maxMult = difficulty > 8 ? 20 : Math.min(12, 3 + difficulty);
        a = Math.floor(Math.random() * maxMult) + 2;
        b = Math.floor(Math.random() * (difficulty > 12 ? 15 : 10)) + 2;
        answer = a * b;
        break;
      case 'division':
        const maxDiv = Math.min(12, 2 + difficulty);
        b = Math.floor(Math.random() * maxDiv) + 2;
        answer = Math.floor(Math.random() * (difficulty > 10 ? 15 : 10)) + 1;
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
    // Zorluk arttıkça soru sayısı artsın: 5, 8, 10, 12
    const qCount = levelData.difficulty <= 5 ? 5 : levelData.difficulty <= 10 ? 8 : levelData.difficulty <= 15 ? 10 : 12;
    const newProblems = Array.from({ length: qCount }, (_, i) => generateProblem(levelData.op, i, levelData.difficulty));
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
      const newStats = { ...stats, coins: stats.coins + 10 };
      setStats(newStats);
      saveToFirestore(newStats);
      
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

  const buyItem = (itemId: string, price: number) => {
    if (stats.coins >= price) {
      const newStats = {
        ...stats,
        coins: stats.coins - price,
        unlockedItems: [...stats.unlockedItems, itemId]
      };
      setStats(newStats);
      saveToFirestore(newStats);
      setMarketMessage("Eşya satın alındı! 🎉");
      setTimeout(() => setMarketMessage(null), 2000);
    } else {
      setMarketMessage("Yeterli altının yok! 💰");
      setTimeout(() => setMarketMessage(null), 2000);
    }
  };

  const updateAvatar = (newAvatar: AvatarConfig) => {
    setAvatar(newAvatar);
    saveToFirestore(stats, newAvatar);
  };

  const completeLevel = () => {
    const reward = isQuickPlay ? 20 : 100;
    const newStats = {
      ...stats,
      coins: stats.coins + reward,
      completedLevels: isQuickPlay ? stats.completedLevels : [...new Set([...stats.completedLevels, currentLevelId])],
      badges: isQuickPlay ? stats.badges : [...new Set([...stats.badges, `${currentLevelId}_master`])]
    };
    setStats(newStats);
    saveToFirestore(newStats);
    setGameState('map');
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Avatar Component
  const AvatarDisplay = ({ config, size = 'md' }: { config: AvatarConfig, size?: 'sm' | 'md' | 'lg' }) => {
    const containerSize = size === 'sm' ? 'w-12 h-12' : size === 'md' ? 'w-32 h-32' : 'w-48 h-48';
    // sm boyutu için md boyutunu ölçeklendiriyoruz (12/32 = 0.375)
    const scale = size === 'sm' ? 0.375 : 1;

    return (
      <div className={`${containerSize} relative mx-auto bg-white rounded-full border-4 border-[#5A5A40]/10 overflow-hidden shadow-inner flex items-center justify-center`}>
        <div 
          className="w-32 h-32 relative shrink-0" 
          style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
        >
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
          {config.accessory === 'scarf' && (
            <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-3/4 h-4 bg-red-600 rounded-full border-b-2 border-red-800 z-10" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-between py-4 sm:py-6 px-2 sm:px-4 font-sans bg-[#F5F5F0] overflow-hidden relative">
      {/* Global Controls (Mute) */}
      <div className="fixed top-4 right-4 z-[60] flex gap-2">
        <button 
          onClick={toggleMute}
          className="p-2.5 bg-white rounded-full shadow-lg border border-[#5A5A40]/10 hover:bg-gray-50 transition-all active:scale-95"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-[#5A5A40]" />}
        </button>
      </div>

      {/* Global Market/Info Message */}
      <AnimatePresence>
        {marketMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#5A5A40] text-white px-6 py-2 rounded-full text-sm font-bold z-[100] shadow-2xl border border-white/20"
          >
            {marketMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Boundary UI */}
      <AnimatePresence>
        {errorInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-4">
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold text-gray-900">Bir Hata Oluştu</h2>
              <p className="text-gray-600">Veritabanı bağlantısında bir sorun yaşadık. Lütfen internet bağlantınızı kontrol edin.</p>
              <div className="bg-gray-100 p-4 rounded-xl text-left text-xs font-mono overflow-auto max-h-32">
                {errorInfo.error}
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-[#5A5A40] text-white rounded-xl font-bold"
              >
                Sayfayı Yenile
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Stats */}
      {gameState !== 'home' && gameState !== 'loading' && (
        <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 flex justify-between items-center z-50 pointer-events-none">
          <div className="flex items-center gap-1.5 sm:gap-3 pointer-events-auto">
            <button onClick={() => setGameState('home')} className="p-1.5 sm:p-2 bg-white rounded-full shadow-sm border border-[#5A5A40]/10 hover:bg-gray-50 transition-colors">
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-[#5A5A40]" />
            </button>
            <div className="scale-75 sm:scale-100 origin-left">
              <AvatarDisplay config={avatar} size="sm" />
            </div>
            <button 
              onClick={() => {
                setMarketMessage("Altınlarınla yeni kıyafetler alabilirsin! 🛍️");
                setTimeout(() => setMarketMessage(null), 3000);
              }}
              className="bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-sm border border-[#5A5A40]/10 cursor-help pointer-events-auto hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-[10px] font-bold text-[#A3A380] block uppercase leading-none mb-1">Altın</span>
              <div className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-yellow-500" />
                <span className="font-bold text-sm text-[#5A5A40]">{stats.coins}</span>
              </div>
            </button>
          </div>
          <div className="flex gap-1.5 pointer-events-auto items-center">
            {stats.badges.map((b, i) => (
              <button 
                key={i} 
                onClick={() => {
                  setMarketMessage("Bu senin başarı madalyan! 🏅");
                  setTimeout(() => setMarketMessage(null), 3000);
                }}
                className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-[#5A5A40]/10 cursor-help pointer-events-auto hover:bg-gray-50 transition-colors"
              >
                <Medal className="w-4 h-4 text-[#5A5A40]" />
              </button>
            ))}
            <button 
              onClick={handleLogout}
              className="p-2 bg-white rounded-full shadow-sm border border-red-100 hover:bg-red-50 transition-colors"
              title="Çıkış Yap"
            >
              <LogOut className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 w-full flex items-center justify-center overflow-hidden pt-12">
        <AnimatePresence mode="wait">
          {gameState === 'loading' && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#5A5A40] font-bold">Yükleniyor...</p>
            </motion.div>
          )}

          {gameState === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="max-w-md w-full text-center space-y-6"
            >
              <div className="space-y-1 sm:space-y-3">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-[24px] sm:rounded-[28px] shadow-xl mx-auto flex items-center justify-center border-2 border-[#5A5A40]/10">
                  <BrainCircuit className="w-8 h-8 sm:w-10 sm:h-10 text-[#5A5A40]" />
                </div>
                <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#2D2D2A]">Sayı Avcıları</h1>
                <p className="text-[#5A5A40] text-xs sm:text-sm font-medium">Matematik hiç bu kadar eğlenceli olmamıştı!</p>
              </div>

              <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-4">
                <button 
                  onClick={() => {
                    setGameState('avatar-creation');
                    if (!isMuted && audioRef.current) audioRef.current.play().catch(() => {});
                  }}
                  className="w-full py-3 sm:py-4 bg-[#5A5A40] text-white rounded-[16px] sm:rounded-[20px] font-bold text-base sm:text-lg shadow-lg hover:bg-[#4A4A35] transition-all flex items-center justify-center gap-2 sm:gap-3 group"
                >
                  <UserIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  Market & Karakter
                </button>

                <button 
                  onClick={() => setGameState('map')}
                  className="w-full py-3 sm:py-4 bg-white text-[#5A5A40] border-2 border-[#5A5A40]/10 rounded-[16px] sm:rounded-[20px] font-bold text-base sm:text-lg shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2 sm:gap-3 group"
                >
                  <MapIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  Maceraya Başla
                </button>

                <button 
                  onClick={() => {
                    setGameState('quick-play-levels');
                    if (!isMuted && audioRef.current) audioRef.current.play().catch(() => {});
                  }}
                  className="w-full py-3 sm:py-4 bg-white text-[#5A5A40] border-2 border-[#5A5A40]/10 rounded-[16px] sm:rounded-[20px] font-bold text-base sm:text-lg shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2 sm:gap-3"
                >
                  <RotateCcw className="w-5 h-5" />
                  Hızlı Antrenman
                </button>

                <button 
                  onClick={fetchLeaderboard}
                  className="w-full py-3 text-[#5A5A40]/60 hover:text-[#5A5A40] font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Trophy className="w-4 h-4" />
                  Liderlik Tablosu
                </button>

                {!user && (
                  <div className="pt-4 space-y-3">
                    <div className="h-px bg-[#5A5A40]/10 w-full" />
                    <p className="text-[#5A5A40]/60 text-[10px] font-bold uppercase tracking-wider">İlerlemeni Kaydet</p>
                    <button 
                      onClick={handleLogin}
                      className="w-full py-3 bg-white text-[#5A5A40] border-2 border-[#5A5A40]/10 rounded-[16px] font-bold text-sm shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      Google ile Giriş Yap
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {gameState === 'leaderboard' && (
            <motion.div 
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-[#5A5A40]/10"
            >
              <div className="text-center mb-6">
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                <h2 className="font-serif text-2xl font-bold text-[#2D2D2A]">Liderlik Tablosu</h2>
                <p className="text-sm text-[#5A5A40]">En iyi 10 avcı!</p>
              </div>

              <div className="space-y-3 mb-8 max-h-[50vh] overflow-y-auto pr-2 scrollbar-hide">
                {leaderboardData.map((entry, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-2xl border ${idx === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 text-center font-bold ${idx < 3 ? 'text-yellow-600' : 'text-gray-400'}`}>
                        {idx + 1}
                      </span>
                      {entry.photoURL ? (
                        <img src={entry.photoURL} alt="" className="w-8 h-8 rounded-full border border-white shadow-sm" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <span className="font-bold text-[#2D2D2A] text-sm truncate max-w-[120px]">
                        {entry.displayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-yellow-500" />
                      <span className="font-bold text-[#5A5A40]">{entry.coins}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setGameState('home')}
                className="w-full py-3 bg-[#5A5A40] text-white rounded-xl font-bold"
              >
                Geri Dön
              </button>
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

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3 max-h-[70vh] overflow-y-auto p-1 sm:p-2 scrollbar-hide">
                {QUICK_LEVELS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => startQuickLevel(l.id)}
                    className="aspect-square bg-white rounded-xl sm:rounded-2xl shadow-sm border border-[#5A5A40]/10 flex flex-col items-center justify-center gap-0.5 sm:gap-1 hover:scale-105 transition-transform"
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
              className="max-w-2xl w-full bg-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-8 shadow-2xl border border-[#5A5A40]/10 overflow-hidden flex flex-col max-h-[85dvh]"
            >
              <h1 className="font-serif text-xl sm:text-2xl font-bold mb-2 sm:mb-6 text-center text-[#2D2D2A] shrink-0">Kahramanını Yarat</h1>
              
              <div className="flex flex-col md:grid md:grid-cols-2 gap-4 sm:gap-8 items-center flex-1 overflow-y-auto scrollbar-hide pb-2">
                <div className="space-y-3 sm:space-y-6 shrink-0">
                  <div className="scale-75 sm:scale-100 origin-center">
                    <AvatarDisplay config={avatar} size="md" />
                  </div>
                  <div className="flex justify-center gap-2">
                    {[
                      { id: 'skin-1', color: '#FFDBAC' },
                      { id: 'skin-2', color: '#F1C27D' },
                      { id: 'skin-3', color: '#E0AC69' },
                      { id: 'skin-4', color: '#8D5524' },
                      { id: 'skin-5', color: '#63C5DA', price: 200 }, // Avatar Mavisi
                      { id: 'skin-6', color: '#FF69B4', price: 200 }, // Pembe Güç
                    ].map(item => {
                      const isUnlocked = stats.unlockedItems.includes(item.id);
                      return (
                        <button 
                          key={item.id}
                          onClick={() => isUnlocked ? updateAvatar({ ...avatar, skinColor: item.color }) : buyItem(item.id, item.price || 0)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${avatar.skinColor === item.color ? 'border-[#5A5A40] scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: item.color }}
                        >
                          {!isUnlocked && <Lock className="w-2.5 h-2.5 text-white drop-shadow-sm" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-[#A3A380] uppercase mb-1.5 block">Saç Stili</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'short', label: 'Kısa' },
                        { id: 'spiky', label: 'Diken' },
                        { id: 'long', label: 'Uzun', price: 150 },
                        { id: 'curly', label: 'Kıvırcık', price: 150 },
                      ].map(item => {
                        const isUnlocked = stats.unlockedItems.includes(`hair-${item.id}`);
                        return (
                          <button 
                            key={item.id}
                            onClick={() => isUnlocked ? updateAvatar({ ...avatar, hairStyle: item.id as any }) : buyItem(`hair-${item.id}`, item.price || 0)}
                            className={`py-1.5 px-3 rounded-lg border-2 text-sm transition-all flex items-center justify-center gap-1 ${avatar.hairStyle === item.id ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-[#F5F5F0] border-transparent text-[#5A5A40]'}`}
                          >
                            {item.label}
                            {!isUnlocked && <Lock className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#A3A380] uppercase mb-1.5 block">Kıyafet Rengi</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'outfit-1', color: '#5A5A40' },
                        { id: 'outfit-2', color: '#A3A380' },
                        { id: 'outfit-3', color: '#E07A5F' },
                        { id: 'outfit-4', color: '#3D405B', price: 100 },
                        { id: 'outfit-5', color: '#81B29A', price: 100 },
                      ].map(item => {
                        const isUnlocked = stats.unlockedItems.includes(item.id);
                        return (
                          <button 
                            key={item.id}
                            onClick={() => isUnlocked ? updateAvatar({ ...avatar, outfitColor: item.color }) : buyItem(item.id, item.price || 0)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${avatar.outfitColor === item.color ? 'border-black' : 'border-transparent'}`}
                            style={{ backgroundColor: item.color }}
                          >
                            {!isUnlocked && <Lock className="w-2.5 h-2.5 text-white drop-shadow-sm" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#A3A380] uppercase mb-1.5 block">Aksesuar</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'none', label: 'Yok' },
                        { id: 'glasses', label: 'Gözlük', price: 100 },
                        { id: 'hat', label: 'Şapka', price: 100 },
                        { id: 'scarf', label: 'Atkı', price: 100 },
                      ].map(item => {
                        const isUnlocked = stats.unlockedItems.includes(`acc-${item.id}`);
                        return (
                          <button 
                            key={item.id}
                            onClick={() => isUnlocked ? updateAvatar({ ...avatar, accessory: item.id as any }) : buyItem(`acc-${item.id}`, item.price || 0)}
                            className={`py-1.5 px-3 rounded-lg border-2 text-sm transition-all flex items-center justify-center gap-1 ${avatar.accessory === item.id ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-[#F5F5F0] border-transparent text-[#5A5A40]'}`}
                          >
                            {item.label}
                            {!isUnlocked && <Lock className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button 
                    onClick={() => setGameState('map')}
                    className="w-full py-2.5 sm:py-3 bg-[#5A5A40] text-white rounded-xl font-bold shadow-lg hover:bg-[#4A4A35] transition-all flex items-center justify-center gap-2 group mt-1 sm:mt-2"
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
              <div className="text-center mb-4 sm:mb-8">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#2D2D2A] mb-0.5 sm:mb-1">Dünya Haritası</h2>
                <p className="text-xs sm:text-sm text-[#5A5A40]">Bilgelik Kristali'ne giden yolu seç!</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
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
                        relative p-3 sm:p-5 rounded-[20px] sm:rounded-[24px] text-left transition-all h-32 sm:h-48 flex flex-col justify-between
                        ${isLocked ? 'bg-gray-200 opacity-50 grayscale cursor-not-allowed' : 'bg-white shadow-xl border border-[#5A5A40]/10'}
                      `}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center mb-1 sm:mb-2" style={{ backgroundColor: level.color + '20' }}>
                        {level.id === 'addition' && <Tent className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: level.color }} />}
                        {level.id === 'subtraction' && <Sun className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: level.color }} />}
                        {level.id === 'multiplication' && <Mountain className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: level.color }} />}
                        {level.id === 'division' && <Snowflake className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: level.color }} />}
                      </div>
                      <div>
                        <h3 className="font-serif text-sm sm:text-lg font-bold text-[#2D2D2A] mb-0.5 leading-tight">{level.title}</h3>
                        <p className="text-[9px] sm:text-[10px] text-[#5A5A40] leading-tight line-clamp-2">{level.description}</p>
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
              className="max-w-md w-full bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 shadow-2xl border border-[#5A5A40]/10 text-center"
            >
              <div className="scale-75 sm:scale-100 origin-center">
                <AvatarDisplay config={avatar} size="md" />
              </div>
              <div className="mt-2 sm:mt-6 mb-4 sm:mb-8">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#2D2D2A] mb-1 sm:mb-3">
                  {gameState === 'story-intro' ? 'Yeni Bölüm!' : 'Tebrikler!'}
                </h3>
                <p className="text-xs sm:text-sm text-[#5A5A40] leading-relaxed italic">
                  "{gameState === 'story-intro' ? currentLevel.storyIntro : currentLevel.storyOutro}"
                </p>
              </div>
              <button 
                onClick={() => gameState === 'story-intro' ? setGameState('playing') : completeLevel()}
                className="w-full py-2.5 sm:py-3.5 bg-[#5A5A40] text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm sm:text-base"
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
              <div className="w-full flex justify-between items-center mb-3 sm:mb-6 gap-2 sm:gap-4 px-1 sm:px-2">
                <div className="flex gap-1 sm:gap-1.5 justify-center">
                  {problems.map((_, i) => (
                    <div 
                      key={i}
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all
                        ${i === currentStep ? 'bg-[#5A5A40] text-white scale-110 shadow-md' : i < currentStep ? 'bg-green-500 text-white' : 'bg-white text-[#5A5A40] border border-[#5A5A40]/10'}
                      `}
                    >
                      {i < currentStep ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : i + 1}
                    </div>
                  ))}
                </div>
                <div className="bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-[#5A5A40]/10 flex items-center gap-1 sm:gap-2 shadow-sm">
                  <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-[10px] sm:text-xs text-[#5A5A40] whitespace-nowrap">{isQuickPlay ? `Seviye ${quickLevel}` : currentLevel.title}</span>
                </div>
              </div>

              {/* Question Card */}
              <div className="w-full bg-white rounded-[24px] sm:rounded-[32px] p-5 sm:p-10 shadow-2xl border border-[#5A5A40]/10 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -30, opacity: 0 }}
                    className="text-center"
                  >
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-[#A3A380] mb-2 sm:mb-3 block">
                      Soru {currentStep + 1} / {problems.length}
                    </span>
                    <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#2D2D2A] mb-6 sm:mb-8">
                      {problems[currentStep].question}
                    </h2>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {problems[currentStep].options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAnswer(opt)}
                          disabled={feedback !== null}
                          className={`
                            py-3 sm:py-4 px-2 sm:px-4 rounded-xl sm:rounded-2xl text-base sm:text-xl font-bold transition-all duration-300
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
