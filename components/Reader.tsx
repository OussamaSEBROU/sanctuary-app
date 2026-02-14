
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'framer-motion';
import { Book, Language, Annotation } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { pdfStorage } from '../services/pdfStorage';
import { 
  ChevronLeft, ChevronRight, Maximize2, Highlighter, 
  PenTool, Square, MessageSquare, Trash2, X, MousePointer2, 
  ListOrdered, Star, Volume2, CloudLightning, Waves, 
  Moon, Bird, Flame, VolumeX, Sparkles, Search, Droplets, PartyPopper,
  Minimize2, Edit3, Award, Layers, LogOut, Sun
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

// Thresholds: 15, 30, 50, 135, 180 minutes in seconds
const STAR_THRESHOLDS = [900, 1800, 3000, 8100, 10800];

export const Reader: React.FC<ReaderProps> = ({ book, lang, onBack, onStatsUpdate }) => {
  const [isZenMode, setIsZenMode] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(book.lastPage || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  
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

  // Zoom State
  const [zoomScale, setZoomScale] = useState(1);
  const initialPinchDistance = useRef<number | null>(null);
  const initialScaleOnPinch = useRef<number>(1);
  const controls = useAnimation();
  
  const timerRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const celebrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';

  // Calculate next star milestone
  const nextThreshold = STAR_THRESHOLDS.find(t => book.timeSpentSeconds < t);
  const remainingSeconds = nextThreshold ? nextThreshold - book.timeSpentSeconds : 0;
  const minsToNextStar = Math.ceil(remainingSeconds / 60);

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
    const loadPdf = async () => {
      const fileData = await pdfStorage.getFile(book.id);
      if (!fileData) { onBack(); return; }
      try {
        const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;
        setTotalPages(pdf.numPages);
        for (let i = 1; i <= Math.min(pdf.numPages, 300); i++) {
          const p = await pdf.getPage(i);
          const vp = p.getViewport({ scale: 2 });
          const cv = document.createElement('canvas');
          cv.height = vp.height; cv.width = vp.width;
          await p.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
          setPages(prev => [...prev, cv.toDataURL('image/jpeg', 0.85)]);
          if (i === 1) setIsLoading(false);
        }
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
      // Initialize pinch to zoom
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      initialPinchDistance.current = dist;
      initialScaleOnPinch.current = zoomScale;
      setIsDrawing(false); // Cancel any drawing if zooming starts
      return;
    }

    if (activeTool !== 'view' && e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      // Handle pinch to zoom
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const newScale = (dist / initialPinchDistance.current) * initialScaleOnPinch.current;
      setZoomScale(Math.max(1, Math.min(newScale, 4))); // Limit zoom to 4x
      return;
    }

    if (isDrawing && e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistance.current = null;
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
    if (activeTool === 'view') return;
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
    if (!isDrawing) return;
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

  const handleDragEnd = (_event: any, info: PanInfo) => {
    if (activeTool !== 'view') return;
    if (zoomScale > 1.2) return;

    const threshold = 40;
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
        {showControls && (
          <motion.header 
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
                  <motion.div 
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
               <button onClick={() => setIsZenMode(!isZenMode)} className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full transition-all active:scale-90 ${isZenMode ? 'bg-[#ff0000] text-white shadow-[0_0_20px_rgba(255,0,0,0.5)]' : 'bg-[#ff0000]/10 text-[#ff0000] border border-[#ff0000]/20'}`}>
                 {isZenMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
               </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main className={`flex-1 flex items-center justify-center bg-black transition-all duration-1000 ${isZenMode ? 'p-0' : 'p-2 md:p-4'} relative overflow-hidden`}>
        {!isLoading && (
          <div className="relative w-full h-full flex items-center justify-center overflow-auto no-scrollbar scroll-smooth p-10">
            <motion.div 
              ref={pageRef} 
              layout
              drag={activeTool === 'view' ? (zoomScale > 1 ? true : 'x') : false}
              dragConstraints={zoomScale <= 1 ? { left: 0, right: 0, top: 0, bottom: 0 } : false}
              onDragEnd={handleDragEnd}
              onDoubleClick={handleDoubleClick}
              onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
              onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
              onMouseUp={handleEnd}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              animate={{ scale: zoomScale }}
              transition={{ type: 'spring', damping: 25, stiffness: 150 }}
              className={`relative shadow-2xl overflow-hidden touch-none transition-shadow duration-700 ${isZenMode ? 'h-[95vh] w-auto aspect-[1/1.41] shadow-[0_0_120px_rgba(255,255,255,0.05)]' : 'max-h-[75vh] md:max-h-[85vh] w-auto aspect-[1/1.41] rounded-xl md:rounded-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)]'}`}
              style={{ 
                backgroundColor: isNightMode ? '#001122' : '#ffffff',
                transformOrigin: 'center center'
              }}
            >
              <img 
                src={pages[currentPage]} 
                className="w-full h-full object-contain pointer-events-none select-none transition-all duration-500" 
                alt="Page" 
                style={{ filter: isNightMode ? 'invert(1) hue-rotate(180deg)' : 'none' }}
              />
              
              <div className="absolute inset-0 pointer-events-none">
                {annotations.filter(a => a.pageIndex === currentPage).map(anno => (
                  <div 
                    key={anno.id} 
                    className="absolute pointer-events-auto cursor-help" 
                    onClick={() => setEditingAnnoId(anno.id)}
                    style={{ 
                      left: `${anno.x}%`, top: `${anno.y}%`, 
                      width: anno.width ? `${anno.width}%` : '0%', 
                      height: anno.height ? `${anno.height}%` : '0%', 
                      backgroundColor: anno.type === 'highlight' ? `${anno.color}66` : 'transparent',
                      borderBottom: anno.type === 'underline' ? `2px solid ${anno.color}` : 'none',
                      border: anno.type === 'box' ? `2px solid ${anno.color}` : 'none'
                    }}
                  >
                    {anno.type === 'note' && <div className="w-6 h-6 md:w-8 md:h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-2xl border-2 border-white"><MessageSquare size={10} className="md:size-4" /></div>}
                    {anno.title && <div className="absolute top-full mt-1 bg-black/80 text-white text-[8px] px-1 rounded backdrop-blur whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">{anno.title}</div>}
                  </div>
                ))}
                {currentRect && (
                  <div 
                    className="absolute border-2 border-dashed" 
                    style={{ 
                      left: `${currentRect.x}%`, top: `${currentRect.y}%`, 
                      width: `${currentRect.w}%`, height: `${currentRect.h}%`,
                      borderColor: activeColor,
                      backgroundColor: `${activeColor}22`
                    }} 
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-8 max-w-xs text-center">
            <div className="relative w-16 h-16 md:w-20 md:h-20">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="absolute inset-0 border-2 border-t-[#ff0000] border-r-transparent border-b-transparent border-l-transparent rounded-full shadow-[0_0_20px_#ff0000]" />
              <div className="absolute inset-1.5 border border-white/5 rounded-full" />
            </div>
            <div className="space-y-4">
              <p className="text-[9px] font-black uppercase tracking-[0.6em] text-[#ff0000] animate-pulse">Reconstructing...</p>
              <p className="text-[10px] md:text-xs text-white/40 font-bold leading-relaxed px-4 italic">
                {t.loadingNote}
              </p>
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] flex flex-col items-center gap-2 w-[90vw] max-w-[420px] pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md pointer-events-auto border border-white/5 shadow-xl"
          >
            <div className="w-1 h-1 rounded-full bg-[#ff0000] animate-pulse" />
            <span className="text-[8px] md:text-[9px] font-black tracking-[0.1em] text-[#ff0000] uppercase">
              {sessionMinutes}Min Concentration
            </span>
          </motion.div>
        </div>

        <AnimatePresence>
          {isToolsMenuOpen && showControls && (
            <motion.div 
              initial={{ y: 20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 bg-black/95 backdrop-blur-3xl border border-white/10 p-1.5 rounded-full shadow-2xl pointer-events-auto mb-1"
            >
              {Object.entries(TOOL_ICONS).map(([id, Icon]) => (
                <button
                  key={id}
                  onClick={() => { setActiveTool(id as Tool); setIsToolsMenuOpen(false); }}
                  className={`p-3 rounded-full transition-all ${activeTool === id ? 'bg-[#ff0000] text-white shadow-lg' : 'text-white/40 hover:bg-white/10'}`}
                >
                  <Icon size={18} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showControls && (
            <motion.div 
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="w-full flex items-center justify-between bg-black/85 backdrop-blur-3xl border border-white/10 px-4 py-1.5 rounded-full shadow-3xl pointer-events-auto group hover:border-[#ff0000]/20 transition-all duration-300"
            >
              <div className="flex items-center gap-2">
                <button onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isToolsMenuOpen ? 'bg-white text-black' : 'bg-white/5 text-[#ff0000] border border-[#ff0000]/20'}`}>
                  <ActiveToolIcon size={16} />
                </button>
                <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-full border border-white/5 relative">
                   {[...Array(5)].map((_, i) => {
                     const isEarned = i < book.stars;
                     const isProgressing = i === book.stars;
                     return (
                       <div key={i} className="relative w-1.5 h-1.5">
                         <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${isEarned ? 'bg-[#ff0000] shadow-[0_0_8px_rgba(255,0,0,0.5)]' : isProgressing ? 'bg-white/10' : 'bg-white/5'}`} />
                         {isProgressing && <motion.div animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 rounded-full bg-[#ff0000]" />}
                       </div>
                     );
                   })}
                   {nextThreshold && (
                     <span className="text-[6px] font-black tracking-tighter text-[#ff0000] ml-1 uppercase opacity-80">
                       -{minsToNextStar}m
                     </span>
                   )}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {/* Wisdom Index - Responsive Redesign */}
        {isArchiveOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-[60px] p-0 md:p-12 flex items-center justify-center overflow-hidden">
             <motion.div 
               initial={{ y: 50, opacity: 0, scale: 0.95 }} 
               animate={{ y: 0, opacity: 1, scale: 1 }} 
               className="w-full max-w-6xl h-full md:h-[90vh] bg-white/[0.03] border border-white/[0.08] rounded-none md:rounded-[4rem] flex flex-col shadow-[0_0_150px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-3xl"
             >
                <div className="p-8 md:p-16 border-b border-white/[0.05] flex items-center justify-between shrink-0 bg-white/[0.02] backdrop-blur-3xl">
                   <div className="flex items-center gap-4 md:gap-8">
                     <div className="w-12 h-12 md:w-20 md:h-20 rounded-xl md:rounded-[2.5rem] bg-gradient-to-br from-[#ff0000] to-[#990000] flex items-center justify-center text-white shadow-[0_20px_50px_rgba(255,0,0,0.3)] border border-white/20">
                        <Layers size={window.innerWidth < 768 ? 24 : 36} />
                     </div>
                     <div>
                       <h2 className="text-2xl md:text-6xl font-black italic uppercase text-white leading-none tracking-tighter drop-shadow-2xl">{t.wisdomIndex}</h2>
                       <p className="text-[9px] md:text-[12px] uppercase font-bold tracking-[0.2em] md:tracking-[0.5em] text-[#ff0000] mt-1 md:mt-3 opacity-60">Cognitive Neural Archive</p>
                     </div>
                   </div>
                   <button onClick={() => setIsArchiveOpen(false)} className="w-12 h-12 md:w-20 md:h-20 flex items-center justify-center bg-white/[0.05] rounded-full hover:bg-[#ff0000] text-white shadow-2xl transition-all active:scale-90 border border-white/[0.1] group">
                      <LogOut size={window.innerWidth < 768 ? 20 : 32} className={`group-hover:scale-110 transition-transform ${isRTL ? "rotate-180" : ""}`} />
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-20 space-y-12 md:space-y-16 bg-gradient-to-br from-transparent via-[#ff0000]/[0.02] to-transparent">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                    {annotations.length === 0 ? (
                      <div className="col-span-full py-20 md:py-60 text-center opacity-10 flex flex-col items-center">
                        <Sparkles size={window.innerWidth < 768 ? 80 : 120} className="mb-6 animate-pulse" />
                        <span className="text-lg md:text-xl font-black uppercase tracking-[0.4em] md:tracking-[0.6em]">{t.noAnnotations}</span>
                      </div>
                    ) : annotations.map(anno => (
                      <motion.div 
                        key={anno.id} 
                        whileHover={{ y: -10, scale: 1.02, backgroundColor: 'rgba(255,255,255,0.06)' }}
                        onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }} 
                        className="relative p-8 md:p-12 bg-white/[0.03] rounded-[2rem] md:rounded-[4rem] border border-white/[0.08] flex flex-col gap-6 md:gap-8 group hover:border-[#ff0000]/30 transition-all duration-500 cursor-pointer overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
                      >
                        <div className="absolute -top-10 -right-10 w-32 md:w-48 h-32 md:h-48 bg-[#ff0000]/10 rounded-full blur-[60px] md:blur-[80px] group-hover:bg-[#ff0000]/20 transition-all pointer-events-none" />
                        
                        <div className="flex items-center justify-between z-10 relative">
                           <div className="px-4 py-1.5 md:px-6 md:py-2.5 bg-[#ff0000]/10 text-[#ff0000] text-[10px] md:text-[12px] font-black rounded-full uppercase border border-[#ff0000]/20 tracking-widest">{t.page} {anno.pageIndex + 1}</div>
                           <button 
                             onClick={(e) => { e.stopPropagation(); setAnnotations(annotations.filter(a => a.id !== anno.id)); }} 
                             className="text-white/5 hover:text-[#ff0000] transition-all p-2 md:p-3 bg-white/[0.03] rounded-full hover:scale-110"
                           >
                             <Trash2 size={window.innerWidth < 768 ? 18 : 24}/>
                           </button>
                        </div>
                        
                        <h4 className="text-xl md:text-3xl text-blue-400 font-black italic uppercase leading-tight tracking-tighter z-10 drop-shadow-lg group-hover:text-white transition-colors">
                          {anno.title || 'Inscribed Truth'}
                        </h4>
                        <p className="text-xs md:text-base text-white/40 line-clamp-4 md:line-clamp-6 leading-relaxed font-bold italic z-10 group-hover:text-white/70 transition-colors">
                          "{anno.text || 'Observation recorded without literal transcription...'}"
                        </p>
                        
                        <div className="mt-auto pt-6 md:pt-8 border-t border-white/5 flex justify-end z-10 relative">
                           <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[#ff0000] opacity-40 group-hover:opacity-100 group-hover:translate-x-1 md:group-hover:translate-x-2 transition-all flex items-center gap-2 md:gap-4">
                             RECALL SOURCE <ChevronRight size={window.innerWidth < 768 ? 14 : 18} />
                           </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
             </motion.div>
          </motion.div>
        )}

        {/* Celebration Overlay */}
        {showStarAchievement && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[3000] bg-black/98 backdrop-blur-[100px] flex items-center justify-center p-6 overflow-hidden">
             <div className="absolute inset-0 pointer-events-none">
                {[...Array(50)].map((_, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ x: 0, y: 0, scale: 0, opacity: 1 }} 
                    animate={{ 
                      x: (Math.random() - 0.5) * window.innerWidth * 2, 
                      y: (Math.random() - 0.5) * window.innerHeight * 2, 
                      scale: Math.random() * 3 + 1, 
                      opacity: 0 
                    }} 
                    transition={{ duration: 5, repeat: Infinity, repeatDelay: 0.1, ease: "easeOut" }} 
                    className="absolute top-1/2 left-1/2"
                  >
                    <PartyPopper size={24} className="text-[#ff0000]" />
                  </motion.div>
                ))}
             </div>
             <motion.div initial={{ scale: 0.5, y: 100 }} animate={{ scale: 1, y: 0 }} className="flex flex-col items-center text-center max-w-2xl z-10">
                <div className="relative mb-8 md:mb-16">
                  <div className="relative p-12 md:p-20 bg-[#ff0000]/10 rounded-full border border-[#ff0000]/30 shadow-[0_0_200px_rgba(255,0,0,0.8)] animate-pulse">
                    <Award size={window.innerWidth < 768 ? 80 : 150} className="text-[#ff0000] drop-shadow-[0_0_50px_#ff0000]" />
                  </div>
                </div>
                <h2 className="text-4xl md:text-9xl font-black italic uppercase text-white mb-6 md:mb-10 leading-none drop-shadow-[0_0_80px_#ff0000] tracking-tighter">{t.starAchieved}</h2>
                <p className="text-sm md:text-2xl text-red-500 font-bold uppercase tracking-[0.3em] md:tracking-[0.5em] mb-12 md:mb-20 max-w-xl mx-auto leading-relaxed">{t.starMotivation}</p>
                <button 
                  onClick={() => setShowStarAchievement(false)} 
                  className="px-12 md:px-24 py-6 md:py-10 bg-white text-black rounded-full font-black uppercase text-sm md:text-lg hover:bg-[#ff0000] hover:text-white transition-all shadow-[0_30px_80px_rgba(255,0,0,0.5)] active:scale-95 border-b-4 md:border-b-8 border-black/20"
                >
                  {t.continueJourney}
                </button>
             </motion.div>
          </motion.div>
        )}

        {isSoundPickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4">
            <div className="bg-[#0b140b] border border-white/10 p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] w-full max-w-md shadow-3xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">{t.soundscape}</h3>
                <button onClick={() => setIsSoundPickerOpen(false)} className="p-2 text-white/40 hover:text-white transition-all"><X size={24}/></button>
              </div>
              <div className="grid gap-3 md:gap-4 overflow-y-auto no-scrollbar pb-6">
                {SOUNDS.map(sound => (
                  <button 
                    key={sound.id} 
                    onClick={() => playSound(sound)} 
                    className={`flex items-center justify-between p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all duration-300 ${activeSoundId === sound.id ? 'bg-[#ff0000]/20 border-[#ff0000]/50 text-white shadow-[0_10px_20px_rgba(255,0,0,0.1)]' : 'bg-white/5 border-transparent text-white/30 hover:bg-white/10 hover:border-white/10'}`}
                  >
                    <div className="flex items-center gap-4 md:gap-5">
                      <sound.icon size={20} className={activeSoundId === sound.id ? "text-[#ff0000]" : ""} />
                      <span className={`text-[10px] md:text-[12px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] ${activeSoundId === sound.id ? "text-white" : ""}`}>{t[sound.id as keyof typeof t] || sound.id}</span>
                    </div>
                    {activeSoundId === sound.id && <div className="w-2.5 h-2.5 rounded-full bg-[#ff0000] shadow-[0_0_10px_#ff0000]" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {isGoToPageOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 md:p-12 rounded-[3rem] md:rounded-[4rem] w-full max-w-md text-center shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
              <h3 className="text-xl md:text-2xl font-black uppercase italic mb-8 md:mb-10 tracking-widest">{t.goToPage}</h3>
              <form onSubmit={jumpToPage}>
                <input autoFocus type="number" value={targetPageInput} onChange={(e) => setTargetPageInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 text-3xl md:text-4xl font-black text-center text-white outline-none focus:border-[#ff0000]/50 mb-8 md:mb-10 shadow-inner" placeholder={`1 - ${totalPages}`} />
                <div className="flex gap-4 md:gap-6">
                  <button type="button" onClick={() => setIsGoToPageOpen(false)} className="flex-1 bg-white/5 py-4 md:py-5 rounded-2xl md:rounded-3xl font-black uppercase text-[10px] tracking-widest text-white/30 hover:bg-white/10 transition-all">{t.discard}</button>
                  <button type="submit" className="flex-1 bg-[#ff0000] py-4 md:py-5 rounded-2xl md:rounded-3xl font-black uppercase text-[10px] tracking-widest text-white shadow-[0_20px_40px_rgba(255,0,0,0.3)] hover:scale-105 transition-all">{t.jump}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {editingAnnoId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2100] bg-black/98 flex items-center justify-center p-0 md:p-6">
            <div className="bg-[#0b140b] border border-white/10 p-8 md:p-14 rounded-none md:rounded-[4rem] w-full max-w-2xl min-h-screen md:min-h-0 shadow-4xl flex flex-col justify-center">
              <div className="flex items-center justify-between mb-10"><h3 className="text-xl md:text-2xl font-black uppercase italic flex items-center gap-4"><Edit3 size={window.innerWidth < 768 ? 24 : 32} className="text-[#ff0000]" /> {t.editDetails}</h3><button onClick={() => setEditingAnnoId(null)} className="p-2 hover:text-[#ff0000] transition-colors"><X size={window.innerWidth < 768 ? 24 : 32}/></button></div>
              <div className="space-y-6">
                <input autoFocus type="text" placeholder={lang === 'ar' ? 'عنوان التعديل...' : 'Mod Title...'} value={annotations.find(a => a.id === editingAnnoId)?.title || ''} onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? { ...a, title: e.target.value } : a))} className="w-full bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-7 text-white font-bold outline-none focus:border-[#ff0000]/40 text-base md:text-lg shadow-inner" />
                <textarea value={annotations.find(a => a.id === editingAnnoId)?.text || ''} onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? { ...a, text: e.target.value } : a))} className="w-full h-40 md:h-48 bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-7 text-white outline-none focus:border-[#ff0000]/30 resize-none text-base md:text-lg shadow-inner" placeholder={lang === 'ar' ? 'اكتب حكمتك هنا...' : 'Inscribe your wisdom...'} />
              </div>
              <div className="flex gap-4 md:gap-6 mt-10 md:mt-12"><button onClick={() => { setAnnotations(annotations.filter(a => a.id !== editingAnnoId)); setEditingAnnoId(null); }} className="flex-1 bg-red-600/10 text-red-600 py-4 md:py-6 rounded-xl md:rounded-[2rem] font-black uppercase text-[10px] tracking-[0.1em] md:tracking-[0.2em]">{t.discard}</button><button onClick={() => setEditingAnnoId(null)} className="flex-1 bg-white text-black py-4 md:py-6 rounded-xl md:rounded-[2rem] font-black uppercase text-[10px] tracking-[0.1em] md:tracking-[0.2em] shadow-2xl hover:bg-[#ff0000] hover:text-white transition-all">{t.save}</button></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
