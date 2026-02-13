
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
  Sparkles, Music
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

const SOUNDS = [
  { id: 'none', icon: VolumeX, url: '' },
  { id: 'rain', icon: CloudLightning, url: '/assets/sounds/rain.mp3' },
  { id: 'sea', icon: Waves, url: '/assets/sounds/sea.mp3' },
  { id: 'river', icon: Droplets, url: '/assets/sounds/river.mp3' },
  { id: 'night', icon: Moon, url: '/assets/sounds/night.mp3' },
  { id: 'birds', icon: Bird, url: '/assets/sounds/birds.mp3' },
  { id: 'fire', icon: Flame, url: '/assets/sounds/fire.mp3' }
];

const CELEBRATION_SOUND_URL = '/assets/sounds/celebration.mp3';

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
  const [customSoundUrl, setCustomSoundUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [targetPageInput, setTargetPageInput] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isFlowActive, setIsFlowActive] = useState(false);
  const [isWindowActive, setIsWindowActive] = useState(true);

  const [showStarCelebration, setShowStarCelebration] = useState(false);
  const prevStarsRef = useRef(book.stars);

  const touchStartRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const controlTimeoutRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  
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

  useEffect(() => {
    if (book.stars > prevStarsRef.current) {
      setShowStarCelebration(true);
      if (celebrationAudioRef.current) {
        celebrationAudioRef.current.volume = 0.8;
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
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(volume * 4, audioContextRef.current.currentTime, 0.1);
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      if (activeSoundId === 'none') {
        audioRef.current.pause();
        audioRef.current.src = '';
      } else if (activeSoundId === 'custom' && customSoundUrl) {
        initAudioEngine();
        audioRef.current.src = customSoundUrl;
        audioRef.current.loop = true;
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
      } else {
        const sound = SOUNDS.find(s => s.id === activeSoundId);
        if (sound && sound.url) {
          initAudioEngine();
          audioRef.current.src = sound.url;
          audioRef.current.loop = true;
          audioRef.current.load();
          if (isWindowActive) audioRef.current.play().catch(() => {});
        }
      }
    }
  }, [activeSoundId, isWindowActive, customSoundUrl]);

  const handleCustomSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomSoundUrl(url);
      setActiveSoundId('custom');
      setIsSoundPickerOpen(false);
    }
  };

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
          if (i === 1) setTimeout(() => setIsLoading(false), 3000);
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
      if (customSoundUrl) URL.revokeObjectURL(customSoundUrl);
    };
  }, [book.id]);

  useEffect(() => {
    storageService.updateBookAnnotations(book.id, annotations);
  }, [annotations]);

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
      }, 5000); 
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    handleActivity();
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [isArchiveOpen, editingAnnoId, isGoToPageOpen, isSoundPickerOpen, showStarCelebration]);

  const toggleZenMode = async () => {
    const nextState = !isZenMode;
    setIsZenMode(nextState);
    if (nextState && containerRef.current?.requestFullscreen) containerRef.current.requestFullscreen();
    else if (document.fullscreenElement) document.exitFullscreen();
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
        type: 'note', pageIndex: currentPage, x, y, text: '', title: '', chapter: '', color: activeColor
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
      x: Math.min(startPos.x, currentX), y: Math.min(startPos.y, currentY),
      w: Math.abs(currentX - startPos.x), h: Math.abs(currentY - startPos.y)
    });
  };

  const handleEnd = (clientX?: number) => {
    if (activeTool === 'view' && touchStartRef.current !== null && clientX !== undefined) {
      const diff = clientX - touchStartRef.current;
      if (Math.abs(diff) > 50) {
        if (isRTL) diff > 0 ? handlePageChange(currentPage + 1) : handlePageChange(currentPage - 1);
        else diff > 0 ? handlePageChange(currentPage - 1) : handlePageChange(currentPage + 1);
      }
      touchStartRef.current = null;
    }
    if (!isDrawing || !currentRect) { setIsDrawing(false); setCurrentRect(null); return; }
    const newAnno: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      type: activeTool as any, pageIndex: currentPage, x: currentRect.x, y: currentRect.y,
      width: currentRect.w, height: activeTool === 'underline' ? 0.8 : currentRect.h,
      color: activeColor, title: '', chapter: '', text: ''
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
      <input type="file" ref={soundInputRef} onChange={handleCustomSoundUpload} accept="audio/*" className="hidden" />
      
      {/* واجهة النجمة والتحصيل */}
      <AnimatePresence>
        {showStarCelebration && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[6000] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-10 text-center">
            <Star size={120} className="text-[#ff0000] fill-[#ff0000] drop-shadow-[0_0_50px_rgba(255,0,0,1)] mb-8" />
            <h2 className="text-4xl md:text-7xl font-black italic text-white uppercase mb-6">{t.starAchieved}</h2>
            <button onClick={() => setShowStarCelebration(false)} className="px-12 py-5 bg-red-600 text-white font-black uppercase text-xs tracking-[0.4em] rounded-full">{t.continueJourney}</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && (
          <motion.header initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="fixed top-0 left-0 right-0 flex items-center justify-between p-3 md:p-10 bg-gradient-to-b from-black/95 to-transparent z-[1001]">
            <div className="flex items-center gap-2 md:gap-5">
              <button onClick={onBack} className="p-2 md:p-5 bg-white/5 rounded-full text-white/60"><ChevronLeft size={20} className={isRTL ? "rotate-180" : ""} /></button>
              <button onClick={() => setIsArchiveOpen(true)} className="p-2 md:p-5 bg-white/5 rounded-full text-white/40"><ListOrdered size={20} /></button>
              <button onClick={() => { setIsSoundPickerOpen(true); initAudioEngine(); }} className="p-2 md:p-5 bg-white/5 rounded-full text-white/40"><Volume2 size={20} /></button>
            </div>
            <div className="flex items-center gap-1 md:gap-2 bg-black/50 p-1.5 rounded-full border border-white/10">
              {[{id: 'view', icon: MousePointer2}, {id: 'highlight', icon: Highlighter}, {id: 'underline', icon: PenTool}, {id: 'box', icon: Square}, {id: 'note', icon: MessageSquare}].map(tool => (
                <button key={tool.id} onClick={() => { setActiveTool(tool.id as Tool); initAudioEngine(); }} className={`p-2 md:p-4 rounded-full transition-all ${activeTool === tool.id ? 'bg-white text-black' : 'text-white/40'}`}><tool.icon size={16}/></button>
              ))}
            </div>
            <div className="flex items-center gap-2 md:gap-5">
              <button onClick={toggleZenMode} className="p-2 md:p-5 bg-white/5 rounded-full text-white/40"><Maximize2 size={20} /></button>
              <div className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center bg-white/5 rounded-full border border-[#ff0000]/30"><Star size={18} className="text-[#ff0000] fill-[#ff0000]" /></div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main className={`flex-1 relative flex items-center justify-center bg-black transition-all ${isZenMode ? 'p-0' : 'p-2 md:p-14'}`} onMouseDown={initAudioEngine} onTouchStart={initAudioEngine}>
        {!isLoading && (
          <div ref={pageRef} onMouseDown={(e) => handleStart(e.clientX, e.clientY)} onMouseMove={(e) => handleMove(e.clientX, e.clientY)} onMouseUp={() => handleEnd()} onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY, true)} onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)} onTouchEnd={(e) => handleEnd(e.changedTouches[0].clientX)} className={`relative shadow-2xl border border-white/10 overflow-hidden bg-white ${isZenMode ? 'h-full w-auto' : 'max-h-[80vh] h-full w-auto aspect-[1/1.41]'}`}>
            <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none" alt="Page" />
            <div className="absolute inset-0 pointer-events-none">
              {currentPageAnnos.map(anno => (
                <div key={anno.id} className="absolute pointer-events-auto" onClick={() => setEditingAnnoId(anno.id)} style={{ left: `${anno.x}%`, top: `${anno.y}%`, width: anno.width ? `${anno.width}%` : 'auto', height: anno.height ? `${anno.height}%` : 'auto', backgroundColor: anno.type === 'highlight' ? `${anno.color}66` : 'transparent', borderBottom: anno.type === 'underline' ? `3px solid ${anno.color}` : 'none', border: anno.type === 'box' ? `2px solid ${anno.color}` : 'none' }}>
                  {anno.type === 'note' && <div className="w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0000] text-white flex items-center justify-center"><MessageSquare size={10} /></div>}
                </div>
              ))}
              {currentRect && <div className="absolute border border-dashed" style={{ left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: activeTool === 'underline' ? '2px' : `${currentRect.h}%`, backgroundColor: activeTool === 'highlight' ? `${activeColor}44` : 'transparent', borderColor: activeColor }} />}
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showControls && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 px-5 py-2.5 rounded-full scale-90 md:scale-100">
            <button onClick={() => handlePageChange(currentPage - 1)} className="text-white/40"><ChevronLeft size={20}/></button>
            <button onClick={() => setIsGoToPageOpen(true)} className="text-xs font-black tracking-widest text-white whitespace-nowrap">
              {currentPage + 1} / {totalPages}
            </button>
            <button onClick={() => handlePageChange(currentPage + 1)} className="text-white/40"><ChevronRight size={20}/></button>
            <div className="w-[1px] h-4 bg-white/10 mx-2" />
            <div className="flex items-center gap-2"><Clock size={12} className="text-[#ff0000]" /><span className="text-[10px] font-black">{sessionMinutes}m</span></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 h-1 bg-white/5"><motion.div className="h-full bg-[#ff0000]" animate={{ width: `${progress}%` }} /></div>
    </div>
  );
};
