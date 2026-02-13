
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Language, Annotation } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { pdfStorage } from '../services/pdfStorage';
import { 
  ChevronLeft, ChevronRight, Maximize2, Highlighter, 
  PenTool, Square, MessageSquare, Trash2, X, MousePointer2, 
  ListOrdered, Minimize2, Star, Trophy, Info, Clock, Hash, Zap, PauseCircle,
  Volume2, CloudLightning, Waves, Droplets, Moon, Bird, Flame, Save, ArrowLeft, VolumeX,
  Sparkles
} from 'lucide-react';

declare const pdfjsLib: any;

interface ReaderProps {
  book: Book;
  lang: Language;
  onBack: () => void;
  onStatsUpdate: () => void;
}

type Tool = 'view' | 'highlight' | 'underline' | 'box' | 'note';
const COLORS = [
  { name: 'Yellow', hex: '#fbbf24' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#a855f7' }
];

// روابط صوتية مباشرة ومستقرة
const SOUNDS = [
  { id: 'none', icon: VolumeX, url: '' },
  { id: 'rain', icon: CloudLightning, url: 'https://www.soundjay.com/nature/rain-01.mp3' },
  { id: 'sea', icon: Waves, url: 'https://www.soundjay.com/nature/ocean-wave-1.mp3' },
  { id: 'river', icon: Droplets, url: 'https://www.soundjay.com/nature/river-1.mp3' },
  { id: 'night', icon: Moon, url: 'https://www.soundjay.com/nature/cricket-chirping-01.mp3' },
  { id: 'birds', icon: Bird, url: 'https://www.soundjay.com/nature/canary-singing-01.mp3' },
  { id: 'fire', icon: Flame, url: 'https://www.soundjay.com/ambient/fire-crackling-01.mp3' }
];

const CELEBRATION_SOUND_URL = 'https://www.soundjay.com/human/applause-01.mp3';

export const Reader: React.FC<ReaderProps> = ({ book, lang, onBack, onStatsUpdate }) => {
  const [isZenMode, setIsZenMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(book.lastPage || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const [activeTool, setActiveTool] = useState<Tool>('view');
  const [activeColor, setActiveColor] = useState(COLORS[0].hex);
  const [annotations, setAnnotations] = useState<Annotation[]>(book.annotations || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const [editingAnnoId, setEditingAnnoId] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isGoToPageOpen, setIsGoToPageOpen] = useState(false);
  const [isSoundPickerOpen, setIsSoundPickerOpen] = useState(false);
  const [activeSoundId, setActiveSoundId] = useState('none');
  const [volume, setVolume] = useState(0.5);
  const [targetPageInput, setTargetPageInput] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isFlowActive, setIsFlowActive] = useState(false);
  const [isWindowActive, setIsWindowActive] = useState(true);

  // نظام النجوم
  const [showStarCelebration, setShowStarCelebration] = useState(false);
  const prevStarsRef = useRef(book.stars);

  const touchStartRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const controlTimeoutRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';

  const totalSeconds = book.timeSpentSeconds;
  const starThreshold = 900; 
  const secondsTowardsNextStar = totalSeconds % starThreshold;
  const starProgress = (secondsTowardsNextStar / starThreshold) * 100;
  const minsToNextStar = Math.ceil((starThreshold - secondsTowardsNextStar) / 60);

  // مراقبة تحصيل النجوم للاحتفال
  useEffect(() => {
    if (book.stars > prevStarsRef.current) {
      setShowStarCelebration(true);
      if (celebrationAudioRef.current) {
        celebrationAudioRef.current.volume = 0.7;
        celebrationAudioRef.current.play().catch(e => console.warn("Celebration audio blocked", e));
      }
      prevStarsRef.current = book.stars;
    }
  }, [book.stars]);

  const initAudioEngine = () => {
    if (!audioContextRef.current && audioRef.current) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const gain = ctx.createGain();
        
        audioRef.current.crossOrigin = "anonymous";
        const source = ctx.createMediaElementSource(audioRef.current);
        
        source.connect(gain);
        gain.connect(ctx.destination);
        
        audioContextRef.current = ctx;
        gainNodeRef.current = gain;

        // تطبيق التضخيم (Gain)
        gain.gain.setValueAtTime(volume * 4, ctx.currentTime);
      } catch (e) {
        console.error("Audio Context Init Failed", e);
      }
    }
    
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  useEffect(() => {
    if (isLoading) {
      const msgInterval = setInterval(() => {
        setLoadingMsgIndex(prev => (prev + 1) % t.loadingMessages.length);
      }, 3000);
      return () => clearInterval(msgInterval);
    }
  }, [isLoading, t.loadingMessages.length]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isActive = document.visibilityState === 'visible';
      setIsWindowActive(isActive);
      if (!isActive && audioRef.current) {
        audioRef.current.pause();
      } else if (isActive && audioRef.current && activeSoundId !== 'none') {
        audioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeSoundId]);

  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(volume * 4, audioContextRef.current.currentTime, 0.1);
    }
  }, [volume]);

  // تشغيل الصوت وتكراره
  useEffect(() => {
    if (audioRef.current) {
      if (activeSoundId === 'none') {
        audioRef.current.pause();
        audioRef.current.src = '';
      } else {
        const sound = SOUNDS.find(s => s.id === activeSoundId);
        if (sound && sound.url) {
          initAudioEngine();
          audioRef.current.src = sound.url;
          audioRef.current.loop = true; // التكرار دائماً
          audioRef.current.load();
          if (isWindowActive) {
            audioRef.current.play().catch(e => console.warn("Playback failed", e));
          }
        }
      }
    }
  }, [activeSoundId, isWindowActive]);

  useEffect(() => {
    const loadPdfVisuals = async () => {
      const fileData = await pdfStorage.getFile(book.id);
      if (!fileData) { onBack(); return; }
      try {
        const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;
        setTotalPages(pdf.numPages);
        const maxPages = Math.min(pdf.numPages, 300); 
        for (let i = 1; i <= maxPages; i++) {
          const p = await pdf.getPage(i);
          const vp = p.getViewport({ scale: 1.5 });
          const cv = document.createElement('canvas');
          cv.height = vp.height; cv.width = vp.width;
          await p.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
          setPages(prev => [...prev, cv.toDataURL('image/jpeg', 0.8)]);
          if (i === 1) {
            setTimeout(() => setIsLoading(false), 4000);
          }
        }
      } catch (err) { console.error(err); }
    };
    loadPdfVisuals();

    timerRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setSessionSeconds(s => s + 1);
        storageService.updateBookStats(book.id, 1);
        onStatsUpdate();
      }
    }, 1000);

    return () => { 
      if (timerRef.current) clearInterval(timerRef.current);
      if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
    };
  }, [book.id]);

  useEffect(() => {
    storageService.updateBookAnnotations(book.id, annotations);
  }, [annotations]);

  useEffect(() => {
    if (sessionSeconds > 300) { 
      setIsFlowActive(true);
    }
  }, [sessionSeconds]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
      storageService.updateBookPage(book.id, newPage);
    }
  };

  const handleGoToPage = (e?: React.FormEvent) => {
    e?.preventDefault();
    const pageNum = parseInt(targetPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum - 1);
      setIsGoToPageOpen(false);
      setTargetPageInput('');
    }
  };

  useEffect(() => {
    const handleActivity = () => {
      setShowControls(true);
      if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
      controlTimeoutRef.current = window.setTimeout(() => {
        if (!isArchiveOpen && editingAnnoId === null && !isGoToPageOpen && !isSoundPickerOpen && !showStarCelebration) {
          setShowControls(false);
        }
      }, isFlowActive ? 3000 : 5000); 
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    handleActivity();
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [isArchiveOpen, editingAnnoId, isGoToPageOpen, isFlowActive, isSoundPickerOpen, showStarCelebration]);

  const toggleZenMode = async () => {
    const nextState = !isZenMode;
    setIsZenMode(nextState);
    if (nextState) {
      if (containerRef.current?.requestFullscreen) containerRef.current.requestFullscreen();
    } else {
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };

  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!pageRef.current) return { x: 0, y: 0 };
    const rect = pageRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    };
  };

  const handleStart = (clientX: number, clientY: number, isTouch = false) => {
    initAudioEngine();
    
    if (activeTool === 'view') {
      if (isTouch) touchStartRef.current = clientX;
      return;
    }
    const { x, y } = getRelativeCoords(clientX, clientY);
    if (activeTool === 'note') {
      const newNote: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'note',
        pageIndex: currentPage,
        x, y,
        text: '',
        title: '',
        chapter: '',
        color: activeColor
      };
      setAnnotations([...annotations, newNote]);
      setEditingAnnoId(newNote.id);
      setActiveTool('view');
      return;
    }
    setIsDrawing(true);
    setStartPos({ x, y });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing) return;
    const { x: currentX, y: currentY } = getRelativeCoords(clientX, clientY);
    setCurrentRect({
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      w: Math.abs(currentX - startPos.x),
      h: Math.abs(currentY - startPos.y)
    });
  };

  const handleEnd = (clientX?: number) => {
    if (activeTool === 'view' && touchStartRef.current !== null && clientX !== undefined) {
      const diff = clientX - touchStartRef.current;
      const threshold = 50;
      if (Math.abs(diff) > threshold) {
        if (isRTL) diff > 0 ? handlePageChange(currentPage + 1) : handlePageChange(currentPage - 1);
        else diff > 0 ? handlePageChange(currentPage - 1) : handlePageChange(currentPage + 1);
      }
      touchStartRef.current = null;
    }
    if (!isDrawing || !currentRect) {
      setIsDrawing(false);
      setCurrentRect(null);
      return;
    }
    const newAnno: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      type: activeTool as any,
      pageIndex: currentPage,
      x: currentRect.x,
      y: currentRect.y,
      width: currentRect.w,
      height: activeTool === 'underline' ? 0.8 : currentRect.h,
      color: activeColor,
      title: '',
      chapter: '',
      text: ''
    };
    setAnnotations([...annotations, newAnno]);
    setEditingAnnoId(newAnno.id);
    setIsDrawing(false);
    setCurrentRect(null);
  };

  const sessionMinutes = Math.floor(sessionSeconds / 60);
  const progress = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;
  const currentPageAnnos = annotations.filter(a => a.pageIndex === currentPage);

  return (
    <div ref={containerRef} className={`h-screen flex flex-col bg-black overflow-hidden select-none relative ${fontClass}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <audio ref={audioRef} crossOrigin="anonymous" hidden />
      <audio ref={celebrationAudioRef} src={CELEBRATION_SOUND_URL} crossOrigin="anonymous" hidden />
      
      {/* واجهة الاحتفال بالفوز بنجمة */}
      <AnimatePresence>
        {showStarCelebration && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[6000] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-10 text-center"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
               {[...Array(30)].map((_, i) => (
                 <motion.div
                   key={i}
                   initial={{ x: '50%', y: '100%', opacity: 1 }}
                   animate={{ 
                     x: `${Math.random() * 100}%`, 
                     y: `${Math.random() * -20}%`,
                     rotate: 360,
                     opacity: 0 
                   }}
                   transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: i * 0.1 }}
                   className="absolute w-1 h-8 bg-gradient-to-t from-red-600 to-transparent"
                 />
               ))}
            </div>

            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 100 }}
              className="relative mb-12"
            >
               <div className="absolute inset-0 bg-red-600 blur-[100px] opacity-50 animate-pulse" />
               <Star size={180} className="text-[#ff0000] fill-[#ff0000] drop-shadow-[0_0_50px_rgba(255,0,0,1)] relative z-10" />
            </motion.div>

            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
               <h2 className="text-4xl md:text-7xl font-black italic text-white uppercase tracking-tighter mb-6">{t.starAchieved}</h2>
               <p className="text-lg md:text-2xl font-bold text-white/70 max-w-2xl leading-relaxed italic mb-12">"{t.starMotivation}"</p>
               <button 
                 onClick={() => setShowStarCelebration(false)}
                 className="px-16 py-6 bg-red-600 text-white font-black uppercase text-xs tracking-[0.6em] rounded-full shadow-[0_0_40px_rgba(255,0,0,0.5)] hover:scale-110 active:scale-95 transition-all flex items-center gap-4 mx-auto"
               >
                 <Sparkles size={18} /> {t.continueJourney}
               </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 pointer-events-none z-0">
         <motion.div 
            animate={{ opacity: isWindowActive ? [0.03, 0.07, 0.03] : 0.01 }} 
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="w-full h-full bg-[#ff0000]/5 blur-[160px]"
         />
      </div>

      <AnimatePresence>
        {editingAnnoId && (
          <motion.div 
            initial={{ opacity: 0, x: isRTL ? 100 : -100 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: isRTL ? 100 : -100 }} 
            className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full md:w-[400px] z-[4000] bg-black/80 backdrop-blur-3xl border-${isRTL ? 'l' : 'r'} border-white/10 shadow-3xl p-8 flex flex-col`}
          >
            <div className="flex items-center justify-between mb-10">
              <button onClick={() => setEditingAnnoId(null)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all text-white/50 flex items-center gap-2 group">
                <ArrowLeft size={20} className={isRTL ? "rotate-180" : ""} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:inline">{t.back}</span>
              </button>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#ff0000]">{t.editDetails}</h3>
              <button onClick={() => { setAnnotations(annotations.filter(a => a.id !== editingAnnoId)); setEditingAnnoId(null); }} className="p-3 bg-red-600/10 text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-all"><Trash2 size={20}/></button>
            </div>

            <div className="flex-1 space-y-10 overflow-y-auto custom-scroll pr-4">
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-25 ml-2">{t.modTitle}</label>
                <input autoFocus className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#ff0000]/40 transition-all shadow-inner" value={annotations.find(a => a.id === editingAnnoId)?.title || ''} onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? {...a, title: e.target.value} : a))} />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-25 ml-2">{t.chapterName}</label>
                <input className="w-full bg-white/5 border border-white/5 p-5 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#ff0000]/40 transition-all shadow-inner" value={annotations.find(a => a.id === editingAnnoId)?.chapter || ''} onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? {...a, chapter: e.target.value} : a))} />
              </div>
              <div className="space-y-3">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-25 ml-2">Reflection / حكمة</label>
                <textarea className="w-full bg-white/5 border border-white/5 p-6 rounded-3xl text-[12px] font-medium text-white/80 outline-none focus:border-[#ff0000]/40 h-56 resize-none custom-scroll leading-relaxed" value={annotations.find(a => a.id === editingAnnoId)?.text || ''} onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? {...a, text: e.target.value} : a))} />
              </div>
              <div className="flex items-center gap-4 pt-4">
                 {COLORS.map(c => (
                   <button 
                     key={c.hex} 
                     onClick={() => setAnnotations(annotations.map(a => a.id === editingAnnoId ? {...a, color: c.hex} : a))}
                     className={`w-9 h-9 rounded-full border-2 transition-all hover:scale-125 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] ${annotations.find(a => a.id === editingAnnoId)?.color === c.hex ? 'border-white scale-110 shadow-xl' : 'border-transparent'}`}
                     style={{ backgroundColor: c.hex }}
                   />
                 ))}
              </div>
            </div>

            <button onClick={() => setEditingAnnoId(null)} className="mt-10 w-full py-6 bg-[#ff0000] text-white font-black uppercase text-[12px] tracking-[0.5em] rounded-[2rem] flex items-center justify-center gap-4 shadow-3xl shadow-red-950/40 active:scale-95 transition-all">
              <Save size={20} /> {t.save}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[5000] bg-black flex flex-col items-center justify-center p-14"
          >
            <motion.div 
              animate={{ rotate: 360, scale: [1, 1.1, 1] }} 
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              className="w-24 h-24 border-b-2 border-t-2 border-[#ff0000] rounded-full shadow-[0_0_50px_rgba(255,0,0,0.5)] mb-16"
            />
            <div className="text-center space-y-8 max-w-lg">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={loadingMsgIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-[11px] md:text-sm font-black uppercase tracking-[0.6em] text-white/80 min-h-[1.5em]"
                >
                  {t.loadingMessages[loadingMsgIndex]}
                </motion.p>
              </AnimatePresence>
              <div className="w-64 h-[2px] bg-white/5 rounded-full mx-auto relative overflow-hidden shadow-2xl">
                 <motion.div 
                   initial={{ x: '-100%' }}
                   animate={{ x: '100%' }}
                   transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                   className="absolute inset-0 bg-gradient-to-r from-transparent via-[#ff0000] to-transparent"
                 />
              </div>
              <motion.p 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 0.4 }} 
                transition={{ delay: 1.5 }}
                className="text-[10px] font-bold uppercase tracking-[0.3em] text-white italic px-12 leading-loose"
              >
                {t.loadingNote}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[1005] transition-opacity duration-1000 ${showControls ? 'opacity-100' : 'opacity-25'}`}>
        <div className={`flex items-center gap-3 bg-black/70 px-6 py-2.5 rounded-full border shadow-2xl ${isWindowActive ? 'border-[#ff0000]/40' : 'border-white/10 shadow-none'}`}>
          {isWindowActive ? (
            <Clock size={12} className={`${isFlowActive ? 'text-[#ff0000] animate-pulse shadow-[0_0_10px_#ff0000]' : 'text-[#ff0000]'}`} />
          ) : (
            <PauseCircle size={12} className="text-white/30" />
          )}
          <span className={`text-[11px] md:text-[13px] font-black tracking-[0.2em] uppercase ${isWindowActive ? 'text-white' : 'text-white/30'}`}>
            {sessionMinutes}{lang === 'ar' ? ' د' : 'm'}
            {isFlowActive && isWindowActive && <Zap size={12} className="inline ml-2 mb-0.5 text-[#ff0000]" />}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {isSoundPickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[3500] flex items-center justify-center p-6 bg-black/85 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, y: 40 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f0f0f] border border-white/10 p-12 rounded-[4rem] w-full max-w-md shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative text-center">
                <button onClick={() => setIsSoundPickerOpen(false)} className="absolute top-10 right-10 p-3 rounded-full bg-white/5 text-white/30 hover:text-white transition-all"><X size={24}/></button>
                <div className="flex flex-col items-center gap-6 mb-10">
                  <div className="p-6 bg-[#ff0000]/10 rounded-full text-[#ff0000] shadow-[0_0_30px_rgba(255,0,0,0.3)]"><Volume2 size={32} /></div>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">{t.soundscape}</h3>
                </div>

                <div className="mb-12 px-6 space-y-6 text-left bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">{t.volume}</span>
                    <span className="text-[12px] font-black text-[#ff0000] bg-black/50 px-3 py-1 rounded-xl shadow-inner">
                      {Math.round(volume * 400)}%
                    </span>
                  </div>
                  <div className="relative h-8 flex items-center">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={volume} 
                      onChange={(e) => { setVolume(parseFloat(e.target.value)); initAudioEngine(); }}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#ff0000] hover:accent-[#ff3333] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {SOUNDS.map(sound => (
                    <button 
                      key={sound.id} 
                      onClick={() => { setActiveSoundId(sound.id); setIsSoundPickerOpen(false); }}
                      className={`flex items-center justify-between p-6 rounded-[1.8rem] transition-all border ${activeSoundId === sound.id ? 'bg-[#ff0000]/15 border-[#ff0000]/40 text-white shadow-lg' : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center gap-5">
                        <sound.icon size={20} className={activeSoundId === sound.id ? 'text-[#ff0000]' : 'text-inherit'} />
                        <span className="text-[12px] font-black uppercase tracking-widest">{(t as any)[sound.id]}</span>
                      </div>
                      {activeSoundId === sound.id && <motion.div layoutId="soundDot" className="w-2 h-2 rounded-full bg-[#ff0000] shadow-[0_0_12px_#ff0000]" />}
                    </button>
                  ))}
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && (
          <motion.header initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-0 left-0 right-0 flex flex-col gap-2 p-4 md:p-10 bg-gradient-to-b from-black/95 to-transparent z-[1001]">
            <div className="flex items-center justify-between w-full max-w-[1920px] mx-auto">
                <div className="flex items-center gap-3 md:gap-5">
                  <button onClick={onBack} className="p-3 md:p-5 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-full hover:bg-[#ff0000] text-white/60 hover:text-white transition-all shadow-2xl group"><ChevronLeft size={24} className={`${isRTL ? "rotate-180" : ""} group-hover:scale-110`} /></button>
                  <button onClick={() => setIsArchiveOpen(true)} className="p-3 md:p-5 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-full text-white/40 hover:text-white relative transition-all shadow-2xl"><ListOrdered size={24} />{annotations.length > 0 && <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-[#ff0000] rounded-full shadow-[0_0_8px_#ff0000]" />}</button>
                  <button onClick={() => { setIsSoundPickerOpen(true); initAudioEngine(); }} className={`p-3 md:p-5 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-full transition-all shadow-2xl ${activeSoundId !== 'none' ? 'text-[#ff0000] border-[#ff0000]/40 bg-[#ff0000]/10' : 'text-white/40 hover:text-white'}`}>
                    {activeSoundId === 'none' ? <Volume2 size={24} /> : React.createElement(SOUNDS.find(s => s.id === activeSoundId)!.icon, { size: 24 })}
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-3xl p-2 rounded-full border border-white/10 shadow-3xl">
                  {[{id: 'view', icon: MousePointer2}, {id: 'highlight', icon: Highlighter}, {id: 'underline', icon: PenTool}, {id: 'box', icon: Square}, {id: 'note', icon: MessageSquare}].map(tool => (
                    <button key={tool.id} onClick={() => { setActiveTool(tool.id as Tool); initAudioEngine(); }} className={`p-3.5 md:p-5 rounded-full transition-all shrink-0 ${activeTool === tool.id ? 'bg-white text-black shadow-2xl scale-110' : 'text-white/40 hover:text-white'}`}><tool.icon size={20}/></button>
                  ))}
                </div>

                <div className="flex items-center gap-3 md:gap-5">
                  <button onClick={toggleZenMode} className={`p-3 md:p-5 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-full transition-all shadow-2xl ${isZenMode ? 'text-[#ff0000] border-[#ff0000]/40' : 'text-white/40 hover:text-white'}`}>{isZenMode ? <Minimize2 size={24} /> : <Maximize2 size={24} />}</button>
                  <div className="relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center bg-white/5 backdrop-blur-3xl border border-white/10 rounded-full shadow-2xl">
                    <svg className="absolute inset-0 w-full h-full -rotate-90 p-1.5"><circle cx="50%" cy="50%" r="42%" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/5" /><circle cx="50%" cy="50%" r="42%" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="100%" strokeDashoffset={`${100 - starProgress}%`} className="text-[#ff0000] transition-all duration-1000" /></svg>
                    <Star size={20} className="text-[#ff0000] fill-[#ff0000] drop-shadow-[0_0_8px_rgba(255,0,0,0.6)]" />
                  </div>
                </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main className={`flex-1 relative flex items-center justify-center overflow-hidden bg-black transition-all duration-1000 ${isZenMode ? 'p-0' : 'p-4 md:p-14'} ${!isWindowActive ? 'grayscale-[0.7] opacity-30' : ''}`} onMouseDown={initAudioEngine} onTouchStart={initAudioEngine}>
        <div className="relative h-full w-full flex items-center justify-center z-10">
          {!isLoading && (
            <div ref={pageRef} onMouseDown={(e) => handleStart(e.clientX, e.clientY)} onMouseMove={(e) => handleMove(e.clientX, e.clientY)} onMouseUp={() => handleEnd()} onTouchStart={(e) => { if(activeTool !== 'view') e.preventDefault(); handleStart(e.touches[0].clientX, e.touches[0].clientY, true); }} onTouchMove={(e) => { if(activeTool !== 'view') e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); }} onTouchEnd={(e) => handleEnd(e.changedTouches[0].clientX)} className={`relative shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden transition-all duration-1000 touch-none ${activeTool === 'view' ? 'cursor-default' : 'cursor-crosshair'} ${isZenMode ? 'h-full w-auto' : 'max-h-[85vh] h-full w-auto aspect-[1/1.41] bg-white'}`}>
              <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none select-none" alt="Page" />
              
              {isFlowActive && !isDrawing && activeTool === 'view' && isWindowActive && (
                <motion.div 
                   animate={{ y: ["0%", "100%", "0%"] }}
                   transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                   className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff0000]/30 to-transparent shadow-[0_0_20px_rgba(255,0,0,0.3)] pointer-events-none"
                />
              )}

              <div className="absolute inset-0 pointer-events-none">
                {currentPageAnnos.map(anno => (
                  <div key={anno.id} className="absolute group pointer-events-auto cursor-pointer" onClick={() => setEditingAnnoId(anno.id)} style={{ left: `${anno.x}%`, top: `${anno.y}%`, width: anno.width ? `${anno.width}%` : 'auto', height: anno.height ? `${anno.height}%` : 'auto', backgroundColor: anno.type === 'highlight' ? `${anno.color}66` : 'transparent', borderBottom: anno.type === 'underline' ? `4px solid ${anno.color}` : 'none', border: anno.type === 'box' ? `2px solid ${anno.color}` : 'none' }}>
                    {anno.type === 'note' && <button className="w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center bg-[#ff0000] text-white shadow-3xl border border-white/30 hover:scale-125 transition-transform"><MessageSquare size={14} /></button>}
                  </div>
                ))}
                {currentRect && <div className="absolute border-2 border-dashed shadow-[0_0_10px_rgba(255,255,255,0.2)]" style={{ left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: activeTool === 'underline' ? '3px' : `${currentRect.h}%`, backgroundColor: activeTool === 'highlight' ? `${activeColor}44` : 'transparent', borderColor: activeColor }} />}
              </div>

              {!isWindowActive && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xl flex items-center justify-center z-50">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-black/90 border border-white/10 px-12 py-6 rounded-[3rem] flex items-center gap-5 shadow-3xl">
                    <PauseCircle className="text-[#ff0000]" size={32} />
                    <span className="text-[12px] font-black uppercase tracking-[0.3em] text-white/90">Neural Archive Paused - Focus Required</span>
                  </motion.div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showControls && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-12 md:bottom-16 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-4 md:gap-7 bg-black/70 backdrop-blur-3xl border border-white/10 px-8 py-4 rounded-full shadow-3xl scale-[0.85] md:scale-100">
            <div className="flex items-center gap-6 text-white/40">
              <button onClick={() => handlePageChange(currentPage - 1)} className="hover:text-white transition-all p-1.5"><ChevronLeft size={24}/></button>
              <button onClick={() => setIsGoToPageOpen(true)} className="flex items-center gap-3 font-black text-sm tracking-widest text-white hover:text-[#ff0000] transition-all">
                <span className="bg-[#ff0000]/15 px-3 py-1 rounded-xl text-[#ff0000] shadow-inner">{currentPage + 1}</span><span className="opacity-10 text-xl font-thin">|</span><span className="opacity-40">{totalPages}</span>
              </button>
              <button onClick={() => handlePageChange(currentPage + 1)} className="hover:text-white transition-all p-1.5"><ChevronRight size={24}/></button>
            </div>
            <div className="w-[1px] h-5 bg-white/10" />
            <div className="flex items-center gap-7">
              <div className="flex flex-col min-w-[90px]"><div className="flex justify-between items-center mb-1.5"><span className="text-[8px] font-black uppercase opacity-30 tracking-widest">{t.nextStar.split(' ')[0]}</span><span className="text-[9px] font-black text-[#ff0000]">{minsToNextStar}m</span></div><div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner"><motion.div animate={{ width: `${starProgress}%` }} className="h-full bg-gradient-to-r from-[#ff0000]/50 to-[#ff0000] shadow-[0_0_10px_#ff0000]" /></div></div>
              <div className="flex items-center gap-2.5 group"><Trophy size={18} className="text-yellow-500 opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all" /><span className="text-sm font-black text-white">{book.stars}</span></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 h-1.5 bg-white/5 z-[1002]"><motion.div className="h-full bg-gradient-to-r from-transparent via-[#ff0000]/70 to-transparent shadow-[0_0_15px_#ff0000]" animate={{ width: `${progress}%` }} /></div>

      <AnimatePresence>
        {isArchiveOpen && (
          <motion.div initial={{ x: isRTL ? '100%' : '-100%' }} animate={{ x: 0 }} exit={{ x: isRTL ? '100%' : '-100%' }} className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full md:w-[500px] z-[2000] bg-[#050505]/98 backdrop-blur-3xl border-${isRTL ? 'l' : 'r'} border-white/10 shadow-3xl flex flex-col`}>
            <div className="p-12 border-b border-white/5 flex items-center justify-between">
               <h3 className="text-3xl md:text-4xl font-black italic tracking-tighter flex items-center gap-6"><ListOrdered size={32} className="text-[#ff0000]" /> {t.wisdomIndex}</h3>
               <button onClick={() => setIsArchiveOpen(false)} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-all text-white/50"><X size={28}/></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll p-10 space-y-6">
              {annotations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 opacity-10"><Info size={56} className="mb-6" /><p className="text-[13px] uppercase font-black tracking-[0.4em]">{t.noAnnotations}</p></div>
              ) : (
                annotations.sort((a,b) => a.pageIndex - b.pageIndex).map(anno => (
                  <button key={anno.id} onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }} className="w-full text-left p-8 bg-white/[0.03] border border-white/5 rounded-[2.5rem] hover:bg-white/[0.08] transition-all flex flex-col gap-4 group">
                    <div className="flex items-center justify-between"><span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#ff0000]">{anno.type} • {t.page} {anno.pageIndex + 1}</span><div className="w-3 h-3 rounded-full shadow-2xl" style={{ backgroundColor: anno.color }} /></div>
                    {anno.chapter && <span className="text-[12px] opacity-40 uppercase font-black tracking-widest">{anno.chapter}</span>}
                    <p className="text-lg font-bold text-white group-hover:text-[#ff0000] transition-colors leading-relaxed">{anno.title || `Entry #${anno.id.slice(0,4)}`}</p>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGoToPageOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[3500] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl">
             <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f0f0f] border border-white/10 p-12 md:p-16 rounded-[5rem] w-full max-w-md shadow-3xl relative text-center">
                <button onClick={() => setIsGoToPageOpen(false)} className="absolute top-10 right-10 p-4 rounded-full bg-white/5 text-white/30 hover:text-white transition-all"><X size={28}/></button>
                <div className="flex flex-col items-center gap-6 mb-12">
                  <div className="p-6 bg-[#ff0000]/10 rounded-full text-[#ff0000] shadow-[0_0_30px_rgba(255,0,0,0.3)]"><Hash size={40} /></div>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter">{t.goToPage}</h3>
                  <p className="text-[12px] font-black opacity-30 uppercase tracking-[0.5em]">{t.page} 1 - {totalPages}</p>
                </div>
                <form onSubmit={handleGoToPage} className="flex flex-col gap-5">
                  <input autoFocus type="number" min="1" max={totalPages} value={targetPageInput} onChange={(e) => setTargetPageInput(e.target.value)} placeholder="e.g. 42" className="w-full bg-black/40 border border-white/10 p-7 rounded-[2rem] text-white font-black text-center text-2xl outline-none focus:border-[#ff0000]/50 transition-all shadow-inner" />
                  <button type="submit" className="w-full py-6 bg-[#ff0000] text-white font-black uppercase text-xs tracking-[0.5em] rounded-[2rem] shadow-3xl hover:scale-105 active:scale-95 transition-all">{t.jump}</button>
                </form>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
