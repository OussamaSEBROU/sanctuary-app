
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Language, Annotation } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { pdfStorage } from '../services/pdfStorage';
import { 
  ChevronLeft, ChevronRight, Maximize2, Highlighter, 
  PenTool, Square, MessageSquare, Trash2, X, MousePointer2, 
  ListOrdered, Star, Clock, Volume2, CloudLightning, Waves, 
  Moon, Bird, Flame, VolumeX, Sparkles, Search, Droplets, PartyPopper,
  Minimize2
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

export const Reader: React.FC<ReaderProps> = ({ book, lang, onBack, onStatsUpdate }) => {
  const [isZenMode, setIsZenMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(book.lastPage || 0);
  const [isLoading, setIsLoading] = useState(true);
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
    }, 3500);
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
        color: activeColor, text: ''
      };
      setAnnotations([...annotations, newAnno]);
    }
    setIsDrawing(false);
    setCurrentRect(null);
  };

  const sessionMinutes = Math.floor(sessionSeconds / 60);

  return (
    <div 
      onMouseMove={handleUserActivity}
      onMouseDown={handleUserActivity}
      onTouchStart={handleUserActivity}
      className={`h-screen flex flex-col bg-black overflow-hidden relative transition-all duration-700 ${isZenMode && !showControls ? 'cursor-none' : ''} ${fontClass}`} 
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

            <div className="flex flex-col items-center gap-2 pointer-events-auto">
              <AnimatePresence>
                {activeTool !== 'view' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                    className="flex items-center gap-1.5 md:gap-2 bg-black/80 backdrop-blur-xl p-2 rounded-full border border-white/10 mb-2 shadow-2xl"
                  >
                    {COLORS.map(color => (
                      <button
                        key={color.hex}
                        onClick={() => setActiveColor(color.hex)}
                        className={`w-5 h-5 md:w-7 md:h-7 rounded-full transition-all hover:scale-125 ${activeColor === color.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'opacity-50'}`}
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-1 md:gap-2 bg-black/60 backdrop-blur-xl p-1 md:p-1.5 rounded-full border border-white/10 overflow-x-auto no-scrollbar max-w-[55vw]">
                {[{id: 'view', icon: MousePointer2}, {id: 'highlight', icon: Highlighter}, {id: 'underline', icon: PenTool}, {id: 'box', icon: Square}, {id: 'note', icon: MessageSquare}].map(tool => (
                  <button 
                    key={tool.id} 
                    onClick={() => setActiveTool(tool.id as Tool)} 
                    className={`p-2 md:p-3.5 rounded-full transition-all shrink-0 ${activeTool === tool.id ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:bg-white/5'}`}
                  >
                    <tool.icon size={16} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
              <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 rounded-full border border-[#ff0000]/20"><Star size={18} className="text-[#ff0000] fill-[#ff0000]/20" /></div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main className={`flex-1 flex items-center justify-center bg-black transition-all duration-1000 ${isZenMode ? 'p-0' : 'p-2 md:p-4'}`}>
        {!isLoading && (
          <motion.div 
            ref={pageRef} 
            layout
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handleEnd}
            className={`relative bg-white shadow-2xl overflow-hidden transition-all duration-700 ${isZenMode ? 'h-screen w-auto aspect-[1/1.41] shadow-[0_0_100px_rgba(255,255,255,0.06)]' : 'max-h-[82vh] md:max-h-[85vh] w-auto aspect-[1/1.41] rounded-lg md:rounded-2xl'}`}
          >
            <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none" alt="Page" />
            
            {/* مؤقت القراءة الأنيق والمتهج */}
            <div className="absolute bottom-5 left-0 right-0 text-center pointer-events-none z-[20]">
              <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-red-600/80 drop-shadow-[0_0_5px_rgba(220,38,38,0.6)]">
                {sessionMinutes}MIN READING
              </span>
            </div>

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
                    borderBottom: anno.type === 'underline' ? `3px solid ${anno.color}` : 'none',
                    border: anno.type === 'box' ? `2px solid ${anno.color}` : 'none'
                  }}
                >
                  {anno.type === 'note' && <div className="w-6 h-6 md:w-8 md:h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-2xl border-2 border-white"><MessageSquare size={10} className="md:size-4" /></div>}
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
            <div className="relative w-20 h-20 md:w-24 md:h-24">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="absolute inset-0 border-4 border-t-[#ff0000] border-r-transparent border-b-transparent border-l-transparent rounded-full shadow-[0_0_15px_#ff0000]" />
              <div className="absolute inset-2 border-2 border-white/5 rounded-full" />
            </div>
            <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.6em] text-[#ff0000] animate-pulse">Neural Reconstruction...</p>
          </div>
        )}
      </main>

      {/* الشريط السفلي الأنيق - ZEN STYLE UI */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: 80, opacity: 0, x: '-50%' }} 
            animate={{ y: 0, opacity: 1, x: '-50%' }} 
            exit={{ y: 80, opacity: 0, x: '-50%' }} 
            className="fixed bottom-6 md:bottom-10 left-1/2 z-[1100] flex items-center justify-between gap-4 md:gap-8 bg-black/70 backdrop-blur-2xl border border-white/10 px-5 py-2 md:py-3 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[85vw] max-w-[440px] border-t border-[#ff0000]/10"
          >
            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={() => handlePageChange(currentPage - 1)} className="p-1.5 md:p-2 text-white/30 hover:text-white transition-colors active:scale-90"><ChevronLeft size={18} /></button>
              
              <button 
                onClick={() => setIsGoToPageOpen(true)} 
                className="px-3 md:px-5 py-1.5 flex items-center gap-2.5 group bg-white/5 rounded-full hover:bg-white/10 transition-all border border-white/5"
              >
                <Search size={14} className="text-white/20 group-hover:text-[#ff0000] transition-colors" />
                <span className="text-[9px] md:text-xs font-black tracking-[0.3em] text-white uppercase group-hover:text-[#ff0000] transition-colors">
                  {currentPage + 1}<span className="opacity-10 mx-1">/</span>{totalPages}
                </span>
              </button>
              
              <button onClick={() => handlePageChange(currentPage + 1)} className="p-1.5 md:p-2 text-white/30 hover:text-white transition-colors active:scale-90"><ChevronRight size={18} /></button>
            </div>

            <div className="w-[1px] h-3.5 bg-white/10" />

            <div className="flex items-center gap-2 pr-1 md:pr-2">
              <Sparkles size={14} className="text-[#ff0000] animate-pulse" />
              <span className="text-[8px] md:text-[10px] font-black text-[#ff0000] tracking-widest uppercase">
                {minsToNextStar}m NEXT
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* زر وضع الاستغراق - أسفل اليسار */}
      <AnimatePresence>
        {(!isZenMode || showControls) && (
          <motion.button
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            onClick={() => setIsZenMode(!isZenMode)}
            className={`fixed bottom-6 left-5 md:left-8 w-11 h-11 md:w-14 md:h-14 flex items-center justify-center rounded-full z-[1200] backdrop-blur-3xl transition-all active:scale-90 border shadow-2xl ${isZenMode ? 'bg-[#ff0000] text-white border-white/20 shadow-[#ff0000]/50 scale-105' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'}`}
          >
            {isZenMode ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
          </motion.button>
        )}
      </AnimatePresence>

      {/* توقيع المطور - صغير جداً */}
      <div className="fixed bottom-2 left-0 right-0 text-center pointer-events-none opacity-10 z-[1001]">
        <span className="text-[6px] md:text-[8px] font-black uppercase tracking-[0.8em] text-white font-en">Developed By Oussama SEBROU</span>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isSoundPickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4">
            <div className="bg-[#0b140b] border border-white/10 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] w-full max-w-md shadow-3xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between mb-8 px-1">
                <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">{t.soundscape}</h3>
                <button onClick={() => setIsSoundPickerOpen(false)} className="p-2 text-white/40 hover:text-white"><X size={24}/></button>
              </div>
              <div className="grid gap-2.5 md:gap-3 overflow-y-auto no-scrollbar pb-6 pr-1">
                {SOUNDS.map(sound => (
                  <button 
                    key={sound.id} 
                    onClick={() => playSound(sound)} 
                    className={`flex items-center justify-between p-4 md:p-5 rounded-2xl border transition-all ${activeSoundId === sound.id ? 'bg-[#ff0000]/20 border-[#ff0000]/40 text-white' : 'bg-white/5 border-transparent text-white/30 hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-3 md:gap-4">
                      <sound.icon size={20} className={activeSoundId === sound.id ? "text-[#ff0000]" : ""} />
                      <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${activeSoundId === sound.id ? "text-white" : ""}`}>{t[sound.id as keyof typeof t] || sound.id}</span>
                    </div>
                    {activeSoundId === sound.id && <motion.div layoutId="sound-check" className="w-2.5 h-2.5 rounded-full bg-[#ff0000] shadow-[0_0_10px_#ff0000]" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {isGoToPageOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6">
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl p-6 overflow-y-auto">
             <div className="max-w-3xl mx-auto py-10 md:py-16">
                <div className="flex items-center justify-between mb-10 md:mb-12">
                  <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3 md:gap-4"><ListOrdered className="text-[#ff0000]" size={28} /> {t.wisdomIndex}</h2>
                  <button onClick={() => setIsArchiveOpen(false)} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={24}/></button>
                </div>
                <div className="grid gap-3 md:gap-4">
                  {annotations.length === 0 ? <p className="text-center py-20 opacity-20 uppercase font-black tracking-widest">{t.noAnnotations}</p> : annotations.map(anno => (
                    <div key={anno.id} className="p-5 md:p-6 bg-white/5 rounded-2xl md:rounded-3xl border border-white/5 flex items-center justify-between group hover:border-[#ff0000]/20 transition-all">
                      <div onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }} className="cursor-pointer flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                           <div className="px-2.5 py-1 bg-[#ff0000]/10 text-[#ff0000] text-[9px] font-black rounded-lg uppercase">{t.page} {anno.pageIndex + 1}</div>
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: anno.color }} />
                        </div>
                        <p className="text-xs md:text-sm text-white/60 line-clamp-2 italic">"{anno.text || `[${anno.type.toUpperCase()}]`}"</p>
                      </div>
                      <button onClick={() => { setAnnotations(annotations.filter(a => a.id !== anno.id)); }} className="p-3 text-white/5 group-hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
                    </div>
                  ))}
                </div>
             </div>
          </motion.div>
        )}

        {editingAnnoId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2100] bg-black/95 flex items-center justify-center p-4 md:p-6">
            <div className="bg-[#0b140b] border border-white/10 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] w-full max-w-xl shadow-4xl">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">{t.editDetails}</h3>
                <button onClick={() => setEditingAnnoId(null)} className="p-2 hover:text-[#ff0000] transition-colors"><X size={24}/></button>
              </div>
              <textarea 
                autoFocus
                value={annotations.find(a => a.id === editingAnnoId)?.text || ''}
                onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? { ...a, text: e.target.value } : a))}
                className="w-full h-40 md:h-48 bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 text-sm md:text-base text-white outline-none focus:border-[#ff0000]/30 mb-8 md:mb-10 resize-none"
                placeholder="..."
              />
              <div className="flex gap-3 md:gap-4">
                <button onClick={() => { setAnnotations(annotations.filter(a => a.id !== editingAnnoId)); setEditingAnnoId(null); }} className="flex-1 bg-red-600/10 text-red-600 py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase text-[10px] tracking-widest">{t.discard}</button>
                <button onClick={() => setEditingAnnoId(null)} className="flex-1 bg-white text-black py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase text-[10px] tracking-widest shadow-xl">{t.save}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
