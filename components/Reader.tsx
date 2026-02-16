
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Language, Annotation } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { pdfStorage } from '../services/pdfStorage';
import { 
  ChevronLeft, ChevronRight, Maximize2, Highlighter, 
  PenTool, Square, MessageSquare, Trash2, X, MousePointer2, 
  ListOrdered, Star, Volume2, CloudLightning, Waves, 
  Moon, Bird, Flame, VolumeX, Sparkles, Search, Droplets, PartyPopper,
  Minimize2, Edit3, Award, Layers, LogOut, Sun, Clock, Loader2, Zap, Rocket, Trophy
} from 'lucide-react';

declare const pdfjsLib: any;

const MotionDiv = motion.div as any;
const MotionHeader = motion.header as any;

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
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Pink', hex: '#ec4899' }
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

const TOOL_ICONS = {
  view: MousePointer2,
  highlight: Highlighter,
  underline: PenTool,
  box: Square,
  note: MessageSquare
};

const STAR_THRESHOLDS = [900, 1800, 3000, 8100, 10800];

export const Reader: React.FC<ReaderProps> = ({ book, lang, onBack, onStatsUpdate }) => {
  const [isZenMode, setIsZenMode] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(book.lastPage || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  
  const [activeTool, setActiveTool] = useState<Tool>('view');
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [activeColor, setActiveColor] = useState(COLORS[0].hex);
  const [annotations, setAnnotations] = useState<Annotation[]>(book.annotations || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const [editingAnnoId, setEditingAnnoId] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isGoToPageOpen, setIsGoToPageOpen] = useState(false);
  const [isSoundPickerOpen, setIsSoundPickerOpen] = useState(false);
  const [showStarAchievement, setShowStarAchievement] = useState(false);
  const [encouragementType, setEncouragementType] = useState<'mid' | 'final' | null>(null);
  const [activeSoundId, setActiveSoundId] = useState('none');
  const [targetPageInput, setTargetPageInput] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [lastProcessedStars, setLastProcessedStars] = useState(book.stars);

  const [zoomScale, setZoomScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const initialPinchDistance = useRef<number | null>(null);
  const initialScaleOnPinch = useRef<number>(1);
  
  const timerRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const loadingIntervalRef = useRef<number | null>(null);
  const triggeredMilestones = useRef<Set<string>>(new Set());

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';

  const currentLevelIndex = STAR_THRESHOLDS.findIndex(th => book.timeSpentSeconds < th);
  const nextThreshold = STAR_THRESHOLDS[currentLevelIndex] || null;
  const prevThreshold = currentLevelIndex > 0 ? STAR_THRESHOLDS[currentLevelIndex - 1] : 0;
  
  const remainingSeconds = nextThreshold ? nextThreshold - book.timeSpentSeconds : 0;
  const minsToNextStar = Math.ceil(remainingSeconds / 60);

  // Toggle Fullscreen and Zen Mode
  const toggleZenMode = async () => {
    if (!isZenMode) {
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if ((docEl as any).webkitRequestFullscreen) {
          await (docEl as any).webkitRequestFullscreen();
        }
      } catch (e) {
        console.warn("Fullscreen not supported or blocked", e);
      }
      setIsZenMode(true);
      setZoomScale(1);
    } else {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsZenMode(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isZenMode) {
        setIsZenMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isZenMode]);

  useEffect(() => {
    if (isZenMode) {
      setShowControls(false);
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    }
  }, [isZenMode]);

  const handleUserActivity = () => {
    if (!isZenMode) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
      setIsToolsMenuOpen(false);
    }, 4500);
  };

  useEffect(() => {
    loadingIntervalRef.current = window.setInterval(() => {
      setLoadingMsgIdx(prev => (prev + 1) % t.loadingMessages.length);
    }, 2500);

    const loadPdf = async () => {
      const fileData = await pdfStorage.getFile(book.id);
      if (!fileData) { onBack(); return; }
      try {
        const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;
        setTotalPages(pdf.numPages);
        
        const targetIdx = book.lastPage || 0;
        const tempPages = new Array(pdf.numPages).fill(null);

        const renderSinglePage = async (idx: number) => {
          if (idx < 0 || idx >= pdf.numPages || tempPages[idx]) return;
          const p = await pdf.getPage(idx + 1);
          const vp = p.getViewport({ scale: 2 });
          const cv = document.createElement('canvas');
          cv.height = vp.height; cv.width = vp.width;
          await p.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
          tempPages[idx] = cv.toDataURL('image/jpeg', 0.85);
          setPages([...tempPages]);
        };

        await renderSinglePage(targetIdx);
        setIsLoading(false);
        if (loadingIntervalRef.current) {
          clearInterval(loadingIntervalRef.current);
          loadingIntervalRef.current = null;
        }

        const loadRest = async () => {
          for (let i = 1; i <= 3; i++) {
            await renderSinglePage(targetIdx + i);
            await renderSinglePage(targetIdx - i);
          }
          for (let i = 0; i < pdf.numPages; i++) {
            if (!tempPages[i]) await renderSinglePage(i);
          }
        };
        loadRest();

      } catch (err) { console.error(err); }
    };
    loadPdf();

    timerRef.current = window.setInterval(() => {
      setSessionSeconds(s => s + 1);
      storageService.updateBookStats(book.id, 1);
      onStatsUpdate();
    }, 1000);

    return () => { 
      if (timerRef.current) clearInterval(timerRef.current); 
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [book.id]);

  // MILSTONE CHECKER: Mid-point and Final Push
  useEffect(() => {
    if (nextThreshold) {
      const midPoint = prevThreshold + (nextThreshold - prevThreshold) / 2;
      const finalPush = nextThreshold - 300; // 5 minutes before

      // Check Mid Point (Trigger once per star)
      const midId = `mid_${nextThreshold}`;
      if (book.timeSpentSeconds >= midPoint && book.timeSpentSeconds < midPoint + 5 && !triggeredMilestones.current.has(midId)) {
        triggeredMilestones.current.add(midId);
        setEncouragementType('mid');
      }

      // Check Final Push (Trigger once per star)
      const finalId = `final_${nextThreshold}`;
      if (book.timeSpentSeconds >= finalPush && book.timeSpentSeconds < finalPush + 5 && !triggeredMilestones.current.has(finalId)) {
        triggeredMilestones.current.add(finalId);
        setEncouragementType('final');
      }
    }
    
    if (book.stars > lastProcessedStars) {
      setLastProcessedStars(book.stars);
      triggerCelebration();
    }
  }, [book.timeSpentSeconds, book.stars]);

  const triggerCelebration = () => {
    if (celebrationAudioRef.current) {
      celebrationAudioRef.current.src = '/assets/sounds/celebration.mp3';
      celebrationAudioRef.current.play().catch(() => {});
    }
    setShowStarAchievement(true);
  };

  useEffect(() => {
    storageService.updateBookAnnotations(book.id, annotations);
  }, [annotations]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setZoomScale(1); 
      setCurrentPage(newPage);
      storageService.updateBookPage(book.id, newPage);
    }
  };

  const jumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(targetPageInput);
    if (!isNaN(p) && p > 0 && p <= totalPages) {
      handlePageChange(p - 1);
      setIsGoToPageOpen(false);
      setTargetPageInput('');
    }
  };

  const playSound = (sound: typeof SOUNDS[0]) => {
    setActiveSoundId(sound.id);
    if (audioRef.current) {
      audioRef.current.pause();
      if (sound.id !== 'none') {
        audioRef.current.src = sound.url;
        audioRef.current.load();
        audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      }
    }
    setIsSoundPickerOpen(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleUserActivity();
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      initialPinchDistance.current = dist;
      initialScaleOnPinch.current = zoomScale;
      setIsPinching(true);
      setIsDrawing(false); 
      setCurrentRect(null);
      return;
    }
    if (activeTool !== 'view' && e.touches.length === 1) handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const newScale = (dist / initialPinchDistance.current) * initialScaleOnPinch.current;
      setZoomScale(Math.max(1, Math.min(newScale, 4))); 
      return;
    }
    if (isDrawing && e.touches.length === 1) handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistance.current = null;
      setIsPinching(false);
    }
    if (isDrawing) handleEnd();
  };

  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!pageRef.current) return { x: 0, y: 0 };
    const rect = pageRef.current.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0.1, Math.min(99.9, rawX)), y: Math.max(0.1, Math.min(99.9, rawY)) };
  };

  const handleStart = (clientX: number, clientY: number) => {
    if (activeTool === 'view' || isPinching) return;
    const { x, y } = getRelativeCoords(clientX, clientY);
    if (activeTool === 'note') {
      const newNote: Annotation = { id: Math.random().toString(36).substr(2, 9), type: 'note', pageIndex: currentPage, x, y, text: '', title: '', color: activeColor };
      setAnnotations([...annotations, newNote]);
      setEditingAnnoId(newNote.id);
      setActiveTool('view');
      return;
    }
    setIsDrawing(true); setStartPos({ x, y }); setCurrentRect({ x, y, w: 0, h: 0 });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing || isPinching) return;
    const { x: currentX, y: currentY } = getRelativeCoords(clientX, clientY);
    setCurrentRect({ x: Math.min(startPos.x, currentX), y: Math.min(startPos.y, currentY), w: Math.max(0.1, Math.abs(currentX - startPos.x)), h: Math.max(0.1, Math.abs(currentY - startPos.y)) });
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    if (currentRect && currentRect.w > 0.4 && currentRect.h > 0.4) {
      const newAnno: Annotation = { id: Math.random().toString(36).substr(2, 9), type: activeTool as any, pageIndex: currentPage, x: currentRect.x, y: currentRect.y, width: currentRect.w, height: activeTool === 'underline' ? 0.8 : currentRect.h, color: activeColor, text: '', title: '' };
      setAnnotations([...annotations, newAnno]);
      setEditingAnnoId(newAnno.id);
    }
    setIsDrawing(false); setCurrentRect(null);
  };

  const handleDragEnd = (_event: any, info: any) => {
    if (activeTool !== 'view' || isPinching) return;
    if (zoomScale > 1.05) return;
    const threshold = 60; 
    if (info.offset.x < -threshold) handlePageChange(currentPage + 1);
    else if (info.offset.x > threshold) handlePageChange(currentPage - 1);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeTool !== 'view') return;
    setZoomScale(zoomScale > 1 ? 1 : 2.5);
  };

  const sessionMinutes = Math.floor(sessionSeconds / 60);
  const ActiveToolIcon = TOOL_ICONS[activeTool];
  const dragConstraints = zoomScale > 1.05 ? undefined : { left: 0, right: 0, top: 0, bottom: 0 };

  return (
    <div 
      onMouseMove={handleUserActivity}
      onMouseDown={handleUserActivity}
      className={`h-screen flex flex-col bg-black overflow-hidden relative transition-all duration-1000 ${isZenMode && !showControls ? 'cursor-none' : ''} ${fontClass}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <audio ref={audioRef} loop hidden />
      <audio ref={celebrationAudioRef} hidden />

      <AnimatePresence>
        {isLoading && (
          <MotionDiv 
            key="loading-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] bg-black flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-12">
               <MotionDiv animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
                 className="w-32 h-32 md:w-48 md:h-48 border border-[#ff0000]/30 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(255,0,0,0.1)]"
               >
                  <Sparkles size={40} className="text-[#ff0000]" />
               </MotionDiv>
            </div>
            <h3 className="text-xl md:text-2xl font-black uppercase italic text-white/80 tracking-[0.3em] leading-tight">
              {t.loadingMessages[loadingMsgIdx]}
            </h3>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && !isZenMode && (
          <MotionHeader initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} 
            className="fixed top-0 left-0 right-0 p-4 md:p-8 flex items-center justify-between z-[1100] bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none"
          >
            <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
              <button onClick={onBack} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 rounded-full text-white/60 hover:bg-white/10 active:scale-90"><ChevronLeft size={20} className={isRTL ? "rotate-180" : ""} /></button>
              <button onClick={() => setIsArchiveOpen(true)} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 rounded-full text-white/40 hover:bg-white/10 active:scale-90"><ListOrdered size={20} /></button>
              <button onClick={() => setIsSoundPickerOpen(true)} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all active:scale-90 ${activeSoundId !== 'none' ? 'bg-[#ff0000] text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}><Volume2 size={20} /></button>
              <button onClick={() => setIsNightMode(!isNightMode)} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all active:scale-90 ${isNightMode ? 'bg-[#ff0000] text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                {isNightMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            <button onClick={toggleZenMode} className={`pointer-events-auto w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-[#ff0000]/10 text-[#ff0000] border border-[#ff0000]/20`}>
              <Maximize2 size={20} />
            </button>
          </MotionHeader>
        )}
      </AnimatePresence>

      <main className="flex-1 flex items-center justify-center bg-black relative overflow-hidden" ref={containerRef}>
        {!isLoading && (
          <div className={`relative w-full h-full flex items-center justify-center overflow-auto no-scrollbar scroll-smooth ${isZenMode ? 'p-0' : 'p-10'}`}>
            <MotionDiv 
              ref={pageRef} 
              drag={activeTool === 'view' && !isPinching}
              dragConstraints={dragConstraints}
              onDragEnd={handleDragEnd}
              onDoubleClick={handleDoubleClick}
              onMouseDown={(e: any) => handleStart(e.clientX, e.clientY)}
              onMouseMove={(e: any) => handleMove(e.clientX, e.clientY)}
              onMouseUp={handleEnd}
              onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
              animate={{ scale: zoomScale }}
              transition={{ type: 'spring', damping: 40, stiffness: 300 }}
              className={`relative shadow-2xl overflow-hidden touch-none ${isZenMode ? 'h-full w-full rounded-none' : 'max-h-[75vh] md:max-h-[85vh] w-auto aspect-[1/1.41] rounded-xl md:rounded-3xl'}`}
              style={{ backgroundColor: isNightMode ? '#001122' : '#ffffff', transformOrigin: 'center center' }}
            >
              <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none select-none transition-all duration-500" style={{ filter: isNightMode ? 'invert(1) hue-rotate(180deg)' : 'none' }} alt="Page" />
              <div className="absolute inset-0 pointer-events-none">
                {annotations.filter(a => a.pageIndex === currentPage).map(anno => (
                  <div key={anno.id} className="absolute pointer-events-auto cursor-help" onClick={() => setEditingAnnoId(anno.id)}
                    style={{ left: `${anno.x}%`, top: `${anno.y}%`, width: anno.width ? `${anno.width}%` : '0%', height: anno.height ? `${anno.height}%` : '0%', 
                      backgroundColor: anno.type === 'highlight' ? `${anno.color}66` : 'transparent', borderBottom: anno.type === 'underline' ? `2px solid ${anno.color}` : 'none', border: anno.type === 'box' ? `2px solid ${anno.color}` : 'none' }}
                  >
                    {anno.type === 'note' && <div className="w-6 h-6 md:w-8 md:h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-2xl border-2 border-white"><MessageSquare size={10} className="md:size-4" /></div>}
                  </div>
                ))}
              </div>
            </MotionDiv>
          </div>
        )}
      </main>

      <AnimatePresence>
        {isZenMode && (
          <MotionDiv initial={{ opacity: 0, x: 20 }} animate={{ opacity: showControls ? 1 : 0.1, x: 0 }}
            className="fixed top-6 right-6 z-[6000] pointer-events-auto flex flex-col items-end gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                <Clock size={12} className="text-[#ff0000] animate-pulse" />
                <span className="text-[10px] font-black text-white/80">{sessionMinutes}m</span>
              </div>
              <button onClick={toggleZenMode} className="w-12 h-12 flex items-center justify-center rounded-full bg-[#ff0000] text-white shadow-xl border border-white/20 backdrop-blur-xl active:scale-90">
                <Minimize2 size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-2 p-1.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl">
              <button onClick={() => setActiveTool(activeTool === 'view' ? 'highlight' : 'view')}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${activeTool !== 'view' ? 'bg-[#ff0000] text-white shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'text-white/40 hover:bg-white/10'}`}
              >
                <Highlighter size={18} />
              </button>
              <button onClick={() => setIsNightMode(!isNightMode)}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${isNightMode ? 'bg-[#ff0000] text-white shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'text-white/40 hover:bg-white/10'}`}
              >
                {isNightMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button onClick={() => setIsSoundPickerOpen(true)}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${activeSoundId !== 'none' ? 'bg-[#ff0000] text-white shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'text-white/40 hover:bg-white/10'}`}
              >
                <Volume2 size={18} />
              </button>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] flex flex-col items-center gap-2 w-[90vw] max-w-[420px] pointer-events-none">
        <AnimatePresence>
          {showControls && (
            <MotionDiv initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} 
              className={`w-full flex items-center justify-between bg-black/85 backdrop-blur-3xl border border-white/10 px-4 py-1.5 rounded-full shadow-3xl pointer-events-auto ${isZenMode ? 'hidden' : ''}`}
            >
              <div className="flex items-center gap-2">
                <button onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} className={`w-8 h-8 flex items-center justify-center rounded-full ${isToolsMenuOpen ? 'bg-white text-black' : 'bg-white/5 text-[#ff0000]'}`}><ActiveToolIcon size={16} /></button>
                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                   {[...Array(5)].map((_, i) => (
                     <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < book.stars ? 'bg-[#ff0000]' : 'bg-white/10'}`} />
                   ))}
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-1 justify-center">
                <button onClick={() => handlePageChange(currentPage - 1)} className="p-1.5 text-white/20 hover:text-[#ff0000]"><ChevronLeft size={16}/></button>
                <button onClick={() => setIsGoToPageOpen(true)} className="px-3 py-0.5 bg-white/5 rounded-full border border-white/5">
                  <span className="text-[9px] font-black text-white/50">{currentPage + 1} / {totalPages}</span>
                </button>
                <button onClick={() => handlePageChange(currentPage + 1)} className="p-1.5 text-white/20 hover:text-[#ff0000]"><ChevronRight size={16}/></button>
              </div>
              <button onClick={() => setIsGoToPageOpen(true)} className="w-8 h-8 flex items-center justify-center text-white/20"><Search size={14} /></button>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>

      {/* FULL-SCREEN CELEBRATION OVERLAY */}
      <AnimatePresence>
        {showStarAchievement && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-10 text-center pointer-events-auto"
          >
            <MotionDiv initial={{ scale: 0.5, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', damping: 12 }}
              className="relative mb-12"
            >
               <div className="absolute inset-0 bg-[#ff0000]/20 blur-[100px] animate-pulse rounded-full" />
               <Trophy size={window.innerWidth < 768 ? 120 : 200} className="text-[#ff0000] drop-shadow-[0_0_50px_rgba(255,0,0,0.8)] relative z-10" />
               <MotionDiv animate={{ scale: [1, 1.5, 1], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}
                 className="absolute -top-10 -right-10 text-yellow-400"
               >
                 <Sparkles size={60} />
               </MotionDiv>
            </MotionDiv>
            
            <h2 className="text-4xl md:text-7xl font-black italic uppercase tracking-tighter text-white mb-6 drop-shadow-2xl">
              {t.starAchieved}
            </h2>
            <p className="text-sm md:text-xl font-bold uppercase tracking-[0.3em] text-[#ff0000]/80 mb-12 max-w-2xl leading-relaxed">
              {t.starMotivation}
            </p>
            
            <button onClick={() => setShowStarAchievement(false)}
              className="px-12 py-5 bg-[#ff0000] text-white rounded-full font-black text-xs md:text-sm uppercase tracking-[0.5em] shadow-[0_20px_50px_rgba(255,0,0,0.4)] hover:scale-110 active:scale-95 transition-all"
            >
              {t.continueJourney}
            </button>
            
            {/* Confetti-like particles */}
            {[...Array(12)].map((_, i) => (
              <MotionDiv key={i} initial={{ x: 0, y: 0, opacity: 0 }} animate={{ x: (Math.random() - 0.5) * 800, y: (Math.random() - 0.5) * 800, opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                className="absolute w-2 h-2 bg-[#ff0000] rounded-full pointer-events-none"
              />
            ))}
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* FULL-SCREEN MOTIVATION OVERLAY (MID & FINAL) */}
      <AnimatePresence>
        {encouragementType && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-10 text-center pointer-events-auto"
          >
            <MotionDiv initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-3xl">
              {encouragementType === 'mid' ? (
                <>
                  <div className="inline-flex p-6 bg-blue-500/10 rounded-full border border-blue-500/20 mb-10 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                    <Rocket size={60} className="text-blue-500 animate-bounce" />
                  </div>
                  <h3 className="text-3xl md:text-6xl font-black italic uppercase text-white mb-6 tracking-tighter">
                    {isRTL ? 'منتصف الطريق بنجاح!' : 'HALFWAY THERE!'}
                  </h3>
                  <p className="text-xs md:text-lg font-bold uppercase tracking-widest text-white/40 mb-12 leading-relaxed">
                    {isRTL ? 'لقد قطعت نصف المسافة نحو النجمة التالية. تركيزك مذهل، استمر في التقدم ولا تتوقف الآن.' : 'You have conquered half the distance to the next star. Your focus is sharp. Keep the momentum!'}
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex p-6 bg-[#ff0000]/10 rounded-full border border-[#ff0000]/20 mb-10 shadow-[0_0_30px_rgba(255,0,0,0.2)]">
                    <Zap size={60} className="text-[#ff0000] animate-pulse" />
                  </div>
                  <h3 className="text-3xl md:text-6xl font-black italic uppercase text-[#ff0000] mb-6 tracking-tighter">
                    {isRTL ? 'أنت على وشك النهاية!' : 'ALMOST AT THE SUMMIT!'}
                  </h3>
                  <p className="text-xs md:text-lg font-bold uppercase tracking-widest text-white/60 mb-12 leading-relaxed">
                    {isRTL ? 'بقي 5 دقائق فقط! شعلة المعرفة توشك على الانفجار بنجمة جديدة. ارفع مستوى تركيزك للأقصى!' : 'Only 5 minutes remain! The light of knowledge is about to ignite a new star. Maximize your focus!'}
                  </p>
                </>
              )}
              
              <button onClick={() => setEncouragementType(null)}
                className="px-10 py-4 border border-white/10 bg-white/5 text-white rounded-full font-black text-[10px] md:text-xs uppercase tracking-[0.4em] hover:bg-[#ff0000] hover:border-[#ff0000] transition-all"
              >
                {isRTL ? 'متابعة الاستغراق' : 'STAY IN FLOW'}
              </button>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isArchiveOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-[60px] p-6 flex items-center justify-center">
             <MotionDiv initial={{ y: 50 }} animate={{ y: 0 }} className="w-full max-w-2xl bg-white/[0.03] border border-white/[0.08] rounded-[3rem] p-8 max-h-[80vh] overflow-y-auto custom-scroll shadow-4xl">
                <div className="flex justify-between items-center mb-8 bg-white/[0.02] p-4 rounded-2xl"><h2 className="text-2xl font-black italic uppercase tracking-tighter">{t.wisdomIndex}</h2><button onClick={() => setIsArchiveOpen(false)} className="hover:text-[#ff0000] transition-colors"><X size={24}/></button></div>
                {annotations.length === 0 ? <p className="text-center opacity-20 py-20 uppercase font-black tracking-widest">{t.noAnnotations}</p> : annotations.map(anno => (
                  <div key={anno.id} onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }} className="p-6 bg-white/[0.03] rounded-2xl mb-4 border border-white/5 cursor-pointer hover:border-[#ff0000]/30 hover:bg-white/[0.06] transition-all group">
                    <span className="text-[10px] font-black text-[#ff0000] uppercase tracking-widest">{t.page} {anno.pageIndex + 1}</span>
                    <p className="text-white/60 italic mt-2 line-clamp-3 group-hover:text-white transition-colors">"{anno.text || '...'}"</p>
                  </div>
                ))}
             </MotionDiv>
          </MotionDiv>
        )}
        {isSoundPickerOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4">
            <div className="bg-[#0b140b] border border-white/10 p-8 rounded-[3rem] w-full max-w-md shadow-3xl">
              <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black italic tracking-widest">{t.soundscape}</h3><button onClick={() => setIsSoundPickerOpen(false)} className="hover:text-[#ff0000] transition-colors"><X size={24}/></button></div>
              <div className="grid gap-3">
                {SOUNDS.map(sound => (
                  <button key={sound.id} onClick={() => playSound(sound)} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${activeSoundId === sound.id ? 'bg-[#ff0000]/20 border-[#ff0000]/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                    <div className="flex items-center gap-3"><sound.icon size={18} className={activeSoundId === sound.id ? "text-[#ff0000]" : ""} /><span className="text-xs font-bold uppercase tracking-widest">{t[sound.id as keyof typeof t] || sound.id}</span></div>
                    {activeSoundId === sound.id && <div className="w-2 h-2 rounded-full bg-[#ff0000] shadow-[0_0_8px_#ff0000]" />}
                  </button>
                ))}
              </div>
            </div>
          </MotionDiv>
        )}
        {isGoToPageOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 text-center">
            <MotionDiv initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 rounded-[3rem] w-full max-w-md shadow-5xl">
              <h3 className="text-xl font-black uppercase mb-8 tracking-widest">{t.goToPage}</h3>
              <form onSubmit={jumpToPage}>
                <input autoFocus type="number" value={targetPageInput} onChange={(e) => setTargetPageInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-3xl font-black text-center text-white outline-none mb-8 focus:border-[#ff0000]/50 shadow-inner" placeholder={`1 - ${totalPages}`} />
                <div className="flex gap-4"><button type="button" onClick={() => setIsGoToPageOpen(false)} className="flex-1 py-4 text-white/30 uppercase font-black text-[10px] tracking-widest">{t.discard}</button><button type="submit" className="flex-1 bg-[#ff0000] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">{t.jump}</button></div>
              </form>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};
