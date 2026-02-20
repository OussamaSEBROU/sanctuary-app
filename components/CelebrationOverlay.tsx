
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Sparkles, Trophy } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n/translations';

interface CelebrationOverlayProps {
  starCount: number;
  lang: Language;
  onComplete: () => void;
}

const MotionDiv = motion.div as any;

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({ starCount, lang, onComplete }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const t = translations[lang];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(e => console.warn("Celebration audio failed:", e));
    }
    const timer = setTimeout(() => {
      onComplete();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-2xl overflow-hidden"
      >
        <audio ref={audioRef} src="/assets/sounds/celebration.mp3" />
        
        {/* Background Particles/Sparkles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <MotionDiv
              key={i}
              initial={{ 
                x: Math.random() * window.innerWidth, 
                y: window.innerHeight + 100,
                scale: 0,
                opacity: 0 
              }}
              animate={{ 
                y: -100,
                scale: [0, 1, 0.5],
                opacity: [0, 1, 0],
                rotate: 360
              }}
              transition={{ 
                duration: Math.random() * 5 + 3, 
                repeat: Infinity, 
                delay: Math.random() * 2 
              }}
              className="absolute text-yellow-500"
            >
              <Sparkles size={Math.random() * 20 + 10} />
            </MotionDiv>
          ))}
        </div>

        <MotionDiv
          initial={{ scale: 0.5, opacity: 0, rotateY: -90 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 100 }}
          className="relative z-10 flex flex-col items-center text-center p-8 max-w-lg"
        >
          <MotionDiv
            animate={{ 
              rotateY: [0, 360],
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="mb-8 relative"
          >
            <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative bg-gradient-to-br from-yellow-400 to-orange-600 p-8 rounded-[2.5rem] shadow-[0_0_50px_rgba(251,191,36,0.5)] border border-yellow-300/30">
              <Trophy size={80} className="text-white drop-shadow-2xl" />
              <div className="absolute -top-4 -right-4 bg-white text-black w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shadow-xl border-4 border-yellow-500">
                {starCount}
              </div>
            </div>
          </MotionDiv>

          <MotionDiv
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">
              {t.starAchieved}
            </h2>
            <div className="h-1 w-24 bg-red-600 mx-auto rounded-full" />
            <p className="text-lg md:text-xl font-bold text-white/80 italic leading-relaxed max-w-md mx-auto px-4">
              {t.starMotivation}
            </p>
          </MotionDiv>

          <MotionDiv
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 flex gap-2"
          >
            {[...Array(starCount)].map((_, i) => (
              <MotionDiv
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8 + i * 0.1, type: "spring" }}
              >
                <Star size={24} className="text-yellow-500 fill-yellow-500 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
              </MotionDiv>
            ))}
          </MotionDiv>
        </MotionDiv>

        {/* 3D-like floating rings */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <MotionDiv
            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="w-[500px] h-[500px] border border-white/5 rounded-full absolute"
          />
          <MotionDiv
            animate={{ rotate: -360, scale: [1, 1.2, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="w-[700px] h-[700px] border border-white/5 rounded-full absolute"
          />
        </div>
      </MotionDiv>
    </AnimatePresence>
  );
};
