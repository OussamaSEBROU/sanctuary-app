
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
  Minimize2, Edit3, Award, Layers, LogOut, Sun, Loader2
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

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';

  const nextThreshold = STAR_THRESHOLDS.find(th => book.timeSpentSeconds < th);
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

        // Helper function to render a specific page
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

        // 1. PRIORITY: Load the current page first and show reader immediately
        await renderSinglePage(targetIdx);
        setIsLoading(false);
        if (loadingIntervalRef.current) {
          clearInterval(loadingIntervalRef.current);
          loadingIntervalRef.current = null;
        }

        // 2. BACKGROUND: Load neighbors for smooth swiping
        const loadNeighbors = async () => {
          for (let i = 1; i <= 3; i++) {
            await renderSinglePage(targetIdx + i);
            await renderSinglePage(targetIdx - i);
          }
        };
        await loadNeighbors();

        // 3. LAZY: Load everything else in the background
        const loadRest = async () => {
          for (let i = 0; i < pdf.numPages; i++) {
            if (!tempPages[i]) {
              await renderSinglePage(i);
            }
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

  useEffect(() => {
    if (book.stars > lastProcessedStars) {
      setLastProcessedStars(book.stars);
      triggerCelebration();
    }
  }, [book.stars]);

  const triggerCelebration = () => {
    if (celebrationAudioRef.current) {
      celebrationAudioRef.current.src = '/assets/sounds/celebration.mp3';
      celebrationAudioRef.current.play().catch(() => {});
      setTimeout(() => {
        if (celebrationAudioRef.current) {
          celebrationAudioRef.current.pause();
          celebrationAudioRef.current.currentTime = 0;
        }
      }, 10000);
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
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      initialPinchDistance.current = dist;
      initialScaleOnPinch.current = zoomScale;
      setIsPinching(true);
      setIsDrawing(false); 
      setCurrentRect(null);
      return;
    }
    if (activeTool !== 'view' && e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const newScale = (dist / initialPinchDistance.current) * initialScaleOnPinch.current;
      setZoomScale(Math.max(1, Math.min(newScale, 4))); 
      return;
    }
    if (isDrawing && e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
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
    return {
      x: Math.max(0.1, Math.min(99.9, rawX)),
      y: Math.max(0.1, Math.min(99.9, rawY))
    };
  };

  const handleStart = (clientX: number, clientY: number) => {
    if (activeTool === 'view' || isPinching) return;
    const { x, y } = getRelativeCoords(clientX, clientY);
    if (activeTool === 'note') {
      const newNote: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'note', pageIndex: currentPage, x, y, text: '', title: '', color: activeColor
      };
      setAnnotations([...annotations, newNote]);
      setEditingAnnoId(newNote.id);
      setActiveTool('view');
      return;
    }
    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentRect({ x, y, w: 0, h: 0 });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing || isPinching) return;
    const { x: currentX, y: currentY } = getRelativeCoords(clientX, clientY);
    setCurrentRect({
      x: Math.min(startPos.x, currentX), y: Math.min(startPos.y, currentY),
      w: Math.max(0.1, Math.abs(currentX - startPos.x)), 
      h: Math.max(0.1, Math.abs(currentY - startPos.y))
    });
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    if (currentRect && currentRect.w > 0.4 && currentRect.h > 0.4) {
      const newAnno: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        type: activeTool as any, pageIndex: currentPage, x: currentRect.x, y: currentRect.y,
        width: currentRect.w, height: activeTool === 'underline' ? 0.8 : currentRect.h,
        color: activeColor, text: '', title: ''
      };
      setAnnotations([...annotations, newAnno]);
      setEditingAnnoId(newAnno.id);
    }
    setIsDrawing(false);
    setCurrentRect(null);
  };

  const handleDragEnd = (_event: any, info: any) => {
    if (activeTool !== 'view' || isPinching) return;
    if (zoomScale > 1.05) return;
    const threshold = 60; 
    if (info.offset.x < -threshold) {
      handlePageChange(currentPage + 1);
    } else if (info.offset.x > threshold) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeTool !== 'view') return;
    if (zoomScale > 1) {
      setZoomScale(1);
    } else {
      setZoomScale(2.5);
    }
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] bg-black flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-12">
               <MotionDiv 
                 animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }} 
                 transition={{ repeat: Infinity, duration: 2 }}
                 className="w-32 h-32 md:w-48 md:h-48 border border-[#ff0000]/30 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(255,0,0,0.1)]"
               >
                  <Sparkles size={40} className="text-[#ff0000]" />
               </MotionDiv>
            </div>
            <AnimatePresence mode="wait">
              <MotionDiv
                key={loadingMsgIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 max-w-md"
              >
                <h3 className="text-xl md:text-2xl font-black uppercase italic text-white/80 tracking-[0.3em] leading-tight">
                  {t.loadingMessages[loadingMsgIdx]}
                </h3>
                <p className="text-[10px] uppercase font-bold text-white/20 mt-4 tracking-widest animate-pulse">
                  {isRTL ? 'استعادة الوعي المعرفي' : 'Restoring Cognitive Awareness'}
                </p>
              </MotionDiv>
            </AnimatePresence>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && !isZenMode && (
          <MotionHeader 
            initial={{ y: -100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: -100, opacity: 0 }} 
            className="fixed top-0 left-0 right-0 p-4 md:p-8 flex items-center justify-between z-[1100] bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none"
          >
            <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
              <button onClick={onBack} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 rounded-full text-white/60 hover:bg-white/10 active:scale-90"><ChevronLeft size={20} className={isRTL ? "rotate-180" : ""} /></button>
              <button onClick={() => setIsArchiveOpen(true)} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 rounded-full text-white/40 hover:bg-white/10 active:scale-90"><ListOrdered size={20} /></button>
              <button onClick={() => setIsSoundPickerOpen(true)} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all active:scale-90 ${activeSoundId !== 'none' ? 'bg-[#ff0000] text-white shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}><Volume2 size={20} /></button>
              <button onClick={() => setIsNightMode(!isNightMode)} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all active:scale-90 ${isNightMode ? 'bg-[#ff0000] text-white shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                {isNightMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            <div className="flex flex-col items-center pointer-events-auto">
              <AnimatePresence>
                {activeTool !== 'view' && (
                  <MotionDiv 
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                    className="flex items-center gap-1.5 bg-black/80 backdrop-blur-xl p-2 rounded-full border border-white/10 mb-2 shadow-2xl"
                  >
                    {COLORS.map(color => (
                      <button
                        key={color.hex}
                        onClick={() => setActiveColor(color.hex)}
                        className={`w-5 h-5 rounded-full transition-all hover:scale-125 ${activeColor === color.hex ? 'ring-1 ring-white ring-offset-1 ring-offset-black scale-110' : 'opacity-30'}`}
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </MotionDiv>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
               <button onClick={toggleZenMode} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all active:scale-90 bg-[#ff0000]/10 text-[#ff0000] border border-[#ff0000]/20`}>
                 <Maximize2 size={20} />
               </button>
            </div>
          </MotionHeader>
        )}
      </AnimatePresence>

      <main className={`flex-1 flex items-center justify-center bg-black transition-all duration-1000 relative overflow-hidden`} ref={containerRef}>
        {!isLoading && (
          <div className={`relative w-full h-full flex items-center justify-center overflow-auto no-scrollbar scroll-smooth ${isZenMode ? 'p-0' : 'p-10'}`}>
            <MotionDiv 
              ref={pageRef} 
              drag={activeTool === 'view' && !isPinching}
              dragConstraints={dragConstraints}
              dragElastic={zoomScale > 1.05 ? 0 : 0.1}
              dragMomentum={zoomScale <= 1.05}
              onDragEnd={handleDragEnd}
              onDoubleClick={handleDoubleClick}
              onMouseDown={(e: any) => handleStart(e.clientX, e.clientY)}
              onMouseMove={(e: any) => handleMove(e.clientX, e.clientY)}
              onMouseUp={handleEnd}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              animate={{ scale: zoomScale }}
              transition={{ type: 'spring', damping: 40, stiffness: 300 }}
              className={`relative shadow-2xl overflow-hidden touch-none transition-shadow duration-700 ${isZenMode ? 'h-full w-full shadow-none rounded-none' : 'max-h-[75vh] md:max-h-[85vh] w-auto aspect-[1/1.41] rounded-xl md:rounded-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)]'}`}
              style={{ 
                backgroundColor: isNightMode ? '#001122' : '#ffffff',
                transformOrigin: 'center center'
              }}
            >
              {pages[currentPage] ? (
                <img 
                  src={pages[currentPage]} 
                  className={`w-full h-full object-contain pointer-events-none select-none transition-all duration-500 ${isZenMode ? 'max-h-screen' : ''}`} 
                  alt="Page" 
                  style={{ filter: isNightMode ? 'invert(1) hue-rotate(180deg)' : 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 animate-pulse">
                  <Loader2 size={30} className="text-white/20 animate-spin" />
                </div>
              )}
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

      {/* Floating Exit Button for Zen Mode */}
      <AnimatePresence>
        {isZenMode && (
          <MotionDiv 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: showControls ? 1 : 0.2, scale: 1 }}
            whileHover={{ opacity: 1, scale: 1.1 }}
            className="fixed top-6 right-6 z-[6000] pointer-events-auto"
          >
            <button 
              onClick={toggleZenMode} 
              className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center rounded-full bg-[#ff0000] text-white shadow-[0_0_30px_rgba(255,0,0,0.5)] border border-white/20 backdrop-blur-xl"
            >
              <Minimize2 size={24} />
            </button>
          </MotionDiv>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] flex flex-col items-center gap-2 w-[90vw] max-w-[420px] pointer-events-none">
        {!isZenMode && (
          <div className="flex items-center gap-2 mb-1">
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md pointer-events-auto border border-white/5 shadow-xl">
              <div className="w-1 h-1 rounded-full bg-[#ff0000] animate-pulse" />
              <span className="text-[8px] md:text-[9px] font-black tracking-[0.1em] text-[#ff0000] uppercase">{sessionMinutes}Min Concentration</span>
            </MotionDiv>
          </div>
        )}
        <AnimatePresence>
          {isToolsMenuOpen && showControls && !isZenMode && (
            <MotionDiv initial={{ y: 20, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.9 }} className="flex items-center gap-1.5 bg-black/95 backdrop-blur-3xl border border-white/10 p-1.5 rounded-full shadow-2xl pointer-events-auto mb-1">
              {Object.entries(TOOL_ICONS).map(([id, Icon]) => (
                <button key={id} onClick={() => { setActiveTool(id as Tool); setIsToolsMenuOpen(false); }} className={`p-3 rounded-full transition-all ${activeTool === id ? 'bg-[#ff0000] text-white shadow-lg' : 'text-white/40 hover:bg-white/10'}`}><Icon size={18} /></button>
              ))}
            </MotionDiv>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showControls && (
            <MotionDiv initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className={`w-full flex items-center justify-between bg-black/85 backdrop-blur-3xl border border-white/10 px-4 py-1.5 rounded-full shadow-3xl pointer-events-auto group hover:border-[#ff0000]/20 transition-all duration-300 ${isZenMode ? 'hidden' : ''}`}>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isToolsMenuOpen ? 'bg-white text-black' : 'bg-white/5 text-[#ff0000] border border-[#ff0000]/20'}`}><ActiveToolIcon size={16} /></button>
                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-full border border-white/5 relative">
                   {[...Array(5)].map((_, i) => (
                     <div key={i} className="relative w-1.5 h-1.5">
                       <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${i < book.stars ? 'bg-[#ff0000] shadow-[0_0_8px_rgba(255,0,0,0.5)]' : i === book.stars ? 'bg-white/10' : 'bg-white/5'}`} />
                       {i === book.stars && <MotionDiv animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 rounded-full bg-[#ff0000]" />}
                     </div>
                   ))}
                   {nextThreshold && <span className="text-[6px] font-black tracking-tighter text-[#ff0000] ml-1 uppercase opacity-80">-{minsToNextStar}m</span>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-1 justify-center">
                <button onClick={() => handlePageChange(currentPage - 1)} className="p-1.5 text-white/20 hover:text-[#ff0000] transition-colors"><ChevronLeft size={16}/></button>
                <button onClick={() => setIsGoToPageOpen(true)} className="px-3 py-0.5 bg-white/5 rounded-full border border-white/5 hover:bg-white/10">
                  <span className="text-[9px] font-black text-white/50">{currentPage + 1}<span className="opacity-10 mx-1">/</span>{totalPages}</span>
                </button>
                <button onClick={() => handlePageChange(currentPage + 1)} className="p-1.5 text-white/20 hover:text-[#ff0000] transition-colors"><ChevronRight size={16}/></button>
              </div>
              <div className="flex items-center pointer-events-auto">
                 <button onClick={() => setIsGoToPageOpen(true)} className="w-8 h-8 flex items-center justify-center text-white/20 hover:text-white"><Search size={14} /></button>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isArchiveOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-[60px] p-0 md:p-12 flex items-center justify-center overflow-hidden">
             <MotionDiv initial={{ y: 50, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="w-full max-w-6xl h-full md:h-[90vh] bg-white/[0.03] border border-white/[0.08] rounded-none md:rounded-[4rem] flex flex-col shadow-[0_0_150px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-3xl">
                <div className="p-8 md:p-16 border-b border-white/[0.05] flex items-center justify-between shrink-0 bg-white/[0.02] backdrop-blur-3xl">
                   <div className="flex items-center gap-4 md:gap-8">
                     <div className="w-12 h-12 md:w-20 md:h-20 rounded-xl md:rounded-[2.5rem] bg-gradient-to-br from-[#ff0000] to-[#990000] flex items-center justify-center text-white shadow-[0_20px_50px_rgba(255,0,0,0.3)] border border-white/20"><Layers size={window.innerWidth < 768 ? 24 : 36} /></div>
                     <div><h2 className="text-2xl md:text-6xl font-black italic uppercase text-white leading-none tracking-tighter drop-shadow-2xl">{t.wisdomIndex}</h2><p className="text-[9px] md:text-[12px] uppercase font-bold tracking-[0.2em] md:tracking-[0.5em] text-[#ff0000] mt-1 md:mt-3 opacity-60">Cognitive Neural Archive</p></div>
                   </div>
                   <button onClick={() => setIsArchiveOpen(false)} className="w-12 h-12 md:w-20 md:h-20 flex items-center justify-center bg-white/[0.05] rounded-full hover:bg-[#ff0000] text-white shadow-2xl transition-all active:scale-90 border border-white/[0.1] group"><LogOut size={window.innerWidth < 768 ? 20 : 32} className={`group-hover:scale-110 transition-transform ${isRTL ? "rotate-180" : ""}`} /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-20 space-y-12 md:space-y-16 bg-gradient-to-br from-transparent via-[#ff0000]/[0.02] to-transparent">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                    {annotations.length === 0 ? (<div className="col-span-full py-20 md:py-60 text-center opacity-10 flex flex-col items-center"><Sparkles size={window.innerWidth < 768 ? 80 : 120} className="mb-6 animate-pulse" /><span className="text-lg md:text-xl font-black uppercase tracking-[0.4em] md:tracking-[0.6em]">{t.noAnnotations}</span></div>) : annotations.map(anno => (
                      <MotionDiv key={anno.id} whileHover={{ y: -10, scale: 1.02, backgroundColor: 'rgba(255,255,255,0.06)' }} onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }} className="relative p-8 md:p-12 bg-white/[0.03] rounded-[2rem] md:rounded-[4rem] border border-white/[0.08] flex flex-col gap-6 md:gap-8 group hover:border-[#ff0000]/30 transition-all duration-500 cursor-pointer overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
                        <div className="absolute -top-10 -right-10 w-32 md:w-48 h-32 md:h-48 bg-[#ff0000]/10 rounded-full blur-[60px] md:blur-[80px] group-hover:bg-[#ff0000]/20 transition-all pointer-events-none" />
                        <div className="flex items-center justify-between z-10 relative">
                           <div className="px-4 py-1.5 md:px-6 md:py-2.5 bg-[#ff0000]/10 text-[#ff0000] text-[10px] md:text-[12px] font-black rounded-full uppercase border border-[#ff0000]/20 tracking-widest">{t.page} {anno.pageIndex + 1}</div>
                           <button onClick={(e: any) => { e.stopPropagation(); setAnnotations(annotations.filter(a => a.id !== anno.id)); }} className="text-white/5 hover:text-[#ff0000] transition-all p-2 md:p-3 bg-white/[0.03] rounded-full hover:scale-110"><Trash2 size={window.innerWidth < 768 ? 18 : 24}/></button>
                        </div>
                        <h4 className="text-xl md:text-3xl text-blue-400 font-black italic uppercase leading-tight tracking-tighter z-10 drop-shadow-lg group-hover:text-white transition-colors">{anno.title || 'Inscribed Truth'}</h4>
                        <p className="text-xs md:text-base text-white/40 line-clamp-4 md:line-clamp-6 leading-relaxed font-bold italic z-10 group-hover:text-white/70 transition-colors">"{anno.text || 'Observation recorded without literal transcription...'}"</p>
                        <div className="mt-auto pt-6 md:pt-8 border-t border-white/5 flex justify-end z-10 relative"><span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[#ff0000] opacity-40 group-hover:opacity-100 group-hover:translate-x-1 md:group-hover:translate-x-2 transition-all flex items-center gap-2 md:gap-4">RECALL SOURCE <ChevronRight size={window.innerWidth < 768 ? 14 : 18} /></span></div>
                      </MotionDiv>
                    ))}
                  </div>
                </div>
             </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSoundPickerOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4">
            <div className="bg-[#0b140b] border border-white/10 p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] w-full max-w-md shadow-3xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between mb-8 md:mb-10"><h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">{t.soundscape}</h3><button onClick={() => setIsSoundPickerOpen(false)} className="p-2 text-white/40 hover:text-white transition-all"><X size={24}/></button></div>
              <div className="grid gap-3 md:gap-4 overflow-y-auto no-scrollbar pb-6">
                {SOUNDS.map(sound => (
                  <button key={sound.id} onClick={() => playSound(sound)} className={`flex items-center justify-between p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all duration-300 ${activeSoundId === sound.id ? 'bg-[#ff0000]/20 border-[#ff0000]/50 text-white shadow-[0_10px_20px_rgba(255,0,0,0.1)]' : 'bg-white/5 border-transparent text-white/30 hover:bg-white/10 hover:border-white/10'}`}>
                    <div className="flex items-center gap-4 md:gap-5"><sound.icon size={20} className={activeSoundId === sound.id ? "text-[#ff0000]" : ""} /><span className={`text-[10px] md:text-[12px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] ${activeSoundId === sound.id ? "text-white" : ""}`}>{t[sound.id as keyof typeof t] || sound.id}</span></div>
                    {activeSoundId === sound.id && <div className="w-2.5 h-2.5 rounded-full bg-[#ff0000] shadow-[0_0_10px_#ff0000]" />}
                  </button>
                ))}
              </div>
            </div>
          </MotionDiv>
        )}
        {isGoToPageOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
            <MotionDiv initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 md:p-12 rounded-[3rem] md:rounded-[4rem] w-full max-w-md text-center shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
              <h3 className="text-xl md:text-2xl font-black uppercase italic mb-8 md:mb-10 tracking-widest">{t.goToPage}</h3>
              <form onSubmit={jumpToPage}>
                <input autoFocus type="number" value={targetPageInput} onChange={(e) => setTargetPageInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 text-3xl md:text-4xl font-black text-center text-white outline-none focus:border-[#ff0000]/50 mb-8 md:mb-10 shadow-inner" placeholder={`1 - ${totalPages}`} />
                <div className="flex gap-4 md:gap-6"><button type="button" onClick={() => setIsGoToPageOpen(false)} className="flex-1 bg-white/5 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black uppercase text-[10px] tracking-widest text-white/30 hover:bg-white/10 transition-all">{t.discard}</button><button type="submit" className="flex-1 bg-[#ff0000] py-4 md:py-5 rounded-2xl md:rounded-3xl font-black uppercase text-[10px] tracking-widest text-white shadow-[0_20px_40px_rgba(255,0,0,0.3)] hover:scale-105 transition-all">{t.jump}</button></div>
              </form>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};
