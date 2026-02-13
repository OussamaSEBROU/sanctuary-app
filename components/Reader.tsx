
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Book, Language, Annotation } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { pdfStorage } from '../services/pdfStorage';
import { 
  ChevronLeft, ChevronRight, Maximize2, Highlighter, 
  PenTool, Square, MessageSquare, Trash2, X, MousePointer2, 
  ListOrdered, Star, Clock, Volume2, CloudLightning, Waves, 
  Moon, Bird, Flame, VolumeX, Sparkles, Search, Droplets, PartyPopper,
  Minimize2, MoreHorizontal, Edit3
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
  { id: 'fire', icon: Flame, url: '/assets/sounds/fire.mp3' },
  { id: 'celebration', icon: PartyPopper, url: '/assets/sounds/celebration.mp3' }
];

const TOOL_ICONS = {
  view: MousePointer2,
  highlight: Highlighter,
  underline: PenTool,
  box: Square,
  note: MessageSquare
};

export const Reader: React.FC<ReaderProps> = ({ book, lang, onBack, onStatsUpdate }) => {
  const [isZenMode, setIsZenMode] = useState(false);
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
  const [activeSoundId, setActiveSoundId] = useState('none');
  const [targetPageInput, setTargetPageInput] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const timerRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';

  const totalSeconds = book.timeSpentSeconds;
  const starThreshold = 900;
  const minsToNextStar = Math.ceil((starThreshold - (totalSeconds % starThreshold)) / 60);
  const starProgressPercent = ((totalSeconds % starThreshold) / starThreshold) * 100;

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
    storageService.updateBookAnnotations(book.id, annotations);
  }, [annotations]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
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
        audioRef.current.play().catch(err => {
          console.error("Audio Playback Error:", err);
          if (audioRef.current) {
            audioRef.current.src = `.${sound.url}`;
            audioRef.current.play().catch(e => console.error("Secondary Path Failure:", e));
          }
        });
      }
    }
    setIsSoundPickerOpen(false);
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
    handleUserActivity();
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
      // Open rename modal immediately for every new annotation to satisfy "naming each modification"
      setEditingAnnoId(newAnno.id);
    }
    setIsDrawing(false);
    setCurrentRect(null);
  };

  const handleDragEnd = (_event: any, info: PanInfo) => {
    if (activeTool !== 'view') return;
    const threshold = 40;
    if (info.offset.x < -threshold) {
      handlePageChange(currentPage + 1);
    } else if (info.offset.x > threshold) {
      handlePageChange(currentPage - 1);
    }
  };

  const sessionMinutes = Math.floor(sessionSeconds / 60);
  const ActiveToolIcon = TOOL_ICONS[activeTool];

  return (
    <div 
      onMouseMove={handleUserActivity}
      onMouseDown={handleUserActivity}
      onTouchStart={handleUserActivity}
      className={`h-screen flex flex-col bg-black overflow-hidden relative transition-all duration-1000 ${isZenMode && !showControls ? 'cursor-none' : ''} ${fontClass}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <audio ref={audioRef} loop hidden />

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

      <main className={`flex-1 flex items-center justify-center bg-black transition-all duration-1000 ${isZenMode ? 'p-0' : 'p-2 md:p-4'}`}>
        {!isLoading && (
          <motion.div 
            ref={pageRef} 
            layout
            drag={activeTool === 'view' ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handleEnd}
            className={`relative bg-white shadow-2xl overflow-hidden transition-all duration-700 ${isZenMode ? 'h-screen w-auto aspect-[1/1.41] shadow-[0_0_120px_rgba(255,255,255,0.05)]' : 'max-h-[75vh] md:max-h-[85vh] w-auto aspect-[1/1.41] rounded-xl md:rounded-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)]'}`}
          >
            <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none select-none" alt="Page" />
            
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
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative w-16 h-16 md:w-20 md:h-20">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="absolute inset-0 border-2 border-t-[#ff0000] border-r-transparent border-b-transparent border-l-transparent rounded-full shadow-[0_0_20px_#ff0000]" />
              <div className="absolute inset-1.5 border border-white/5 rounded-full" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.6em] text-[#ff0000] animate-pulse">Reconstructing...</p>
          </div>
        )}
      </main>

      {/* Modern Compact ZEN Bottom Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: 50, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 50, opacity: 0, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-[1100] flex flex-col items-center gap-4 w-[90vw] max-w-[420px] pointer-events-none"
          >
            {/* Tools Expanded Menu */}
            <AnimatePresence>
              {isToolsMenuOpen && (
                <motion.div 
                  initial={{ y: 20, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 20, opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-1.5 bg-black/90 backdrop-blur-3xl border border-white/10 p-1.5 rounded-full shadow-2xl pointer-events-auto"
                >
                  {Object.entries(TOOL_ICONS).map(([id, Icon]) => (
                    <button
                      key={id}
                      onClick={() => { setActiveTool(id as Tool); setIsToolsMenuOpen(false); }}
                      className={`p-3 rounded-full transition-all ${activeTool === id ? 'bg-[#ff0000] text-white' : 'text-white/40 hover:bg-white/10'}`}
                    >
                      <Icon size={18} />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Primary Bar */}
            <div className="w-full flex items-center justify-between bg-black/80 backdrop-blur-2xl border border-white/10 px-4 py-2.5 rounded-full shadow-3xl pointer-events-auto group">
              
              {/* Tool Selector + Stars Cluster */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isToolsMenuOpen ? 'bg-white text-black' : 'bg-white/5 text-[#ff0000] border border-[#ff0000]/20 hover:border-[#ff0000]/50 shadow-[0_0_15px_rgba(255,0,0,0.1)]'}`}
                >
                  <ActiveToolIcon size={18} />
                </button>
                
                {/* Horizontal Minimalist Stars Bar */}
                <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                   {[...Array(5)].map((_, i) => {
                     const isEarned = i < book.stars;
                     const isProgressing = i === book.stars;
                     return (
                       <div key={i} className="relative w-2 h-2">
                         <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${isEarned ? 'bg-[#ff0000] opacity-80 shadow-[0_0_8px_rgba(255,0,0,0.5)]' : isProgressing ? 'bg-white/10' : 'bg-white/5'}`} />
                         {isProgressing && (
                            <motion.div 
                              animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.4, 1] }} 
                              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                              className="absolute inset-0 rounded-full bg-[#ff0000] shadow-[0_0_12px_#ff0000]"
                            />
                         )}
                       </div>
                     );
                   })}
                   <span className="text-[7px] font-black tracking-tighter text-[#ff0000]/40 ml-1 uppercase group-hover:opacity-100 opacity-30 transition-opacity">
                     {minsToNextStar}m
                   </span>
                </div>
              </div>

              <div className="h-4 w-[1px] bg-white/10 mx-1" />

              {/* Navigation Cluster */}
              <div className="flex items-center gap-1">
                <button onClick={() => handlePageChange(currentPage - 1)} className="p-1.5 text-white/20 hover:text-[#ff0000] transition-colors"><ChevronLeft size={18}/></button>
                <button onClick={() => setIsGoToPageOpen(true)} className="px-3 py-1 bg-white/5 rounded-full border border-white/5 hover:bg-white/10 transition-all">
                  <span className="text-[9px] font-black text-white/60 group-hover:text-white transition-colors">
                    {currentPage + 1}<span className="opacity-10 mx-1">/</span>{totalPages}
                  </span>
                </button>
                <button onClick={() => handlePageChange(currentPage + 1)} className="p-1.5 text-white/20 hover:text-[#ff0000] transition-colors"><ChevronRight size={18}/></button>
              </div>

              <div className="h-4 w-[1px] bg-white/10 mx-1" />

              {/* Timer Cluster */}
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff0000] animate-pulse" />
                <span className="text-[9px] font-black text-[#ff0000]/80 group-hover:text-[#ff0000] group-hover:drop-shadow-[0_0_5px_#ff0000] tracking-widest transition-all">
                  {sessionMinutes}M
                </span>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Developer Signature */}
      <div className="fixed bottom-1 left-0 right-0 text-center pointer-events-none opacity-[0.03] z-[1001]">
        <span className="text-[5px] font-black uppercase tracking-[1.5em] text-white">OUSSAMA SEBROU</span>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isSoundPickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4">
            <div className="bg-[#0b140b] border border-white/10 p-6 md:p-10 rounded-[2.5rem] w-full max-w-md shadow-3xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between mb-8 px-1">
                <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">{t.soundscape}</h3>
                <button onClick={() => setIsSoundPickerOpen(false)} className="p-2 text-white/40 hover:text-white"><X size={24}/></button>
              </div>
              <div className="grid gap-2 overflow-y-auto no-scrollbar pb-6 pr-1">
                {SOUNDS.map(sound => (
                  <button 
                    key={sound.id} 
                    onClick={() => playSound(sound)} 
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${activeSoundId === sound.id ? 'bg-[#ff0000]/10 border-[#ff0000]/30 text-white' : 'bg-white/5 border-transparent text-white/20 hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-3">
                      <sound.icon size={18} className={activeSoundId === sound.id ? "text-[#ff0000]" : ""} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${activeSoundId === sound.id ? "text-white" : ""}`}>{t[sound.id as keyof typeof t] || sound.id}</span>
                    </div>
                    {activeSoundId === sound.id && <div className="w-1.5 h-1.5 rounded-full bg-[#ff0000] shadow-[0_0_8px_#ff0000]" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {isGoToPageOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 rounded-[2.5rem] w-full max-w-sm shadow-3xl text-center">
              <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8">{t.goToPage}</h3>
              <form onSubmit={jumpToPage}>
                <input autoFocus type="number" value={targetPageInput} onChange={(e) => setTargetPageInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-2xl font-black text-center text-white outline-none focus:border-[#ff0000]/50 mb-8" placeholder={`1 - ${totalPages}`} />
                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsGoToPageOpen(false)} className="flex-1 bg-white/5 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">{t.discard}</button>
                  <button type="submit" className="flex-1 bg-[#ff0000] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-xl">{t.jump}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isArchiveOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/98 backdrop-blur-3xl p-6 overflow-y-auto">
             <div className="max-w-3xl mx-auto py-12">
                <div className="flex items-center justify-between mb-12">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-4"><ListOrdered className="text-[#ff0000]" size={28} /> {t.wisdomIndex}</h2>
                  <button onClick={() => setIsArchiveOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={24}/></button>
                </div>
                <div className="grid gap-4">
                  {annotations.length === 0 ? <p className="text-center py-20 opacity-20 uppercase font-black tracking-widest">{t.noAnnotations}</p> : annotations.map(anno => (
                    <div key={anno.id} className="p-5 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between group hover:border-[#ff0000]/20 transition-all">
                      <div onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }} className="cursor-pointer flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                           <div className="px-2.5 py-1 bg-[#ff0000]/10 text-[#ff0000] text-[9px] font-black rounded-lg uppercase">{t.page} {anno.pageIndex + 1}</div>
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: anno.color }} />
                        </div>
                        <p className="text-xs text-white/60 line-clamp-2 italic font-bold">"{anno.title || 'Untitled Acquisition'}"</p>
                        <p className="text-[10px] text-white/30 line-clamp-1 mt-1">{anno.text || 'No description provided.'}</p>
                      </div>
                      <button onClick={() => { setAnnotations(annotations.filter(a => a.id !== anno.id)); }} className="p-3 text-white/5 group-hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
                    </div>
                  ))}
                </div>
             </div>
          </motion.div>
        )}

        {editingAnnoId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2100] bg-black/98 flex items-center justify-center p-6">
            <div className="bg-[#0b140b] border border-white/10 p-8 md:p-10 rounded-[3rem] w-full max-w-xl shadow-4xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3"><Edit3 size={24} className="text-[#ff0000]" /> {t.editDetails}</h3>
                <button onClick={() => setEditingAnnoId(null)} className="p-2 hover:text-[#ff0000] transition-colors"><X size={24}/></button>
              </div>
              <div className="space-y-4">
                <input 
                  autoFocus
                  type="text"
                  placeholder={lang === 'ar' ? 'عنوان التعديل...' : 'Mod Title...'}
                  value={annotations.find(a => a.id === editingAnnoId)?.title || ''}
                  onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? { ...a, title: e.target.value } : a))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold outline-none focus:border-[#ff0000]/40"
                />
                <textarea 
                  value={annotations.find(a => a.id === editingAnnoId)?.text || ''}
                  onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? { ...a, text: e.target.value } : a))}
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-[#ff0000]/30 resize-none"
                  placeholder={lang === 'ar' ? 'اكتب حكمتك هنا...' : 'Inscribe your wisdom...'}
                />
              </div>
              <div className="flex gap-4 mt-8">
                <button onClick={() => { setAnnotations(annotations.filter(a => a.id !== editingAnnoId)); setEditingAnnoId(null); }} className="flex-1 bg-red-600/10 text-red-600 py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest">{t.discard}</button>
                <button onClick={() => setEditingAnnoId(null)} className="flex-1 bg-white text-black py-4 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl">{t.save}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
