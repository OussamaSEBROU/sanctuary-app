
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Language, Annotation } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { pdfStorage } from '../services/pdfStorage';
import { 
  ChevronLeft, ChevronRight, Maximize2, Highlighter, 
  PenTool, Square, MessageSquare, Trash2, X, MousePointer2, 
  ListOrdered, Minimize2, Star, Trophy, Info, Bookmark, Clock, Hash, Zap, PauseCircle,
  Volume2, CloudLightning, Waves, Droplets, Moon, Bird, Flame, Save, ArrowLeft
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
  { id: 'none', icon: Volume2, url: '' },
  { id: 'rain', icon: CloudLightning, url: 'https://actions.google.com/sounds/v1/weather/thunder_storm.ogg' },
  { id: 'sea', icon: Waves, url: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_shore.ogg' },
  { id: 'river', icon: Droplets, url: 'https://actions.google.com/sounds/v1/water/river_stream.ogg' },
  { id: 'night', icon: Moon, url: 'https://actions.google.com/sounds/v1/ambient/night_ambience.ogg' },
  { id: 'birds', icon: Bird, url: 'https://actions.google.com/sounds/v1/ambient/morning_birds.ogg' },
  { id: 'fire', icon: Flame, url: 'https://actions.google.com/sounds/v1/ambient/fire_crackle.ogg' }
];

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
  const [targetPageInput, setTargetPageInput] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [isFlowActive, setIsFlowActive] = useState(false);
  const [isWindowActive, setIsWindowActive] = useState(true);

  const touchStartRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const controlTimeoutRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';

  const totalSeconds = book.timeSpentSeconds;
  const starThreshold = 900; 
  const secondsTowardsNextStar = totalSeconds % starThreshold;
  const starProgress = (secondsTowardsNextStar / starThreshold) * 100;
  const minsToNextStar = Math.ceil((starThreshold - secondsTowardsNextStar) / 60);

  // تحديث رسائل التحميل كل 2.5 ثانية
  useEffect(() => {
    if (isLoading) {
      const msgInterval = setInterval(() => {
        setLoadingMsgIndex(prev => (prev + 1) % t.loadingMessages.length);
      }, 2500);
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

  // محرك تشغيل الصوت المحسن
  useEffect(() => {
    if (audioRef.current) {
      if (activeSoundId === 'none') {
        audioRef.current.pause();
        audioRef.current.src = '';
      } else {
        const sound = SOUNDS.find(s => s.id === activeSoundId);
        if (sound && sound.url) {
          audioRef.current.src = sound.url;
          audioRef.current.volume = 1.0; // أعلى مستوى صوت ممكن
          audioRef.current.load();
          if (isWindowActive) {
            audioRef.current.play().catch(error => {
              console.warn("Audio Context error:", error);
            });
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
            // إضافة تأخير بسيط للتحميل السينمائي ليرى المستخدم الرسائل
            setTimeout(() => setIsLoading(false), 3000);
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
        if (!isArchiveOpen && editingAnnoId === null && !isGoToPageOpen && !isSoundPickerOpen) {
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
  }, [isArchiveOpen, editingAnnoId, isGoToPageOpen, isFlowActive, isSoundPickerOpen]);

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
      <audio ref={audioRef} loop crossOrigin="anonymous" />
      
      <div className="fixed inset-0 pointer-events-none z-0">
         <motion.div 
            animate={{ opacity: isWindowActive ? [0.02, 0.05, 0.02] : 0.01 }} 
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="w-full h-full bg-[#ff0000]/10 blur-[120px]"
         />
      </div>

      {/* لوحة تعديلات احترافية مدمجة (Side Drawer) */}
      <AnimatePresence>
        {editingAnnoId && (
          <motion.div 
            initial={{ opacity: 0, x: isRTL ? 100 : -100 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: isRTL ? 100 : -100 }} 
            className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full md:w-[350px] z-[4000] bg-black/80 backdrop-blur-3xl border-${isRTL ? 'l' : 'r'} border-white/10 shadow-2xl p-8 flex flex-col`}
          >
            <div className="flex items-center justify-between mb-10">
              <button onClick={() => setEditingAnnoId(null)} className="p-2.5 bg-white/5 rounded-full hover:bg-white/10 transition-all text-white/50 flex items-center gap-2 group">
                <ArrowLeft size={18} className={isRTL ? "rotate-180" : ""} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:inline">{t.back}</span>
              </button>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#ff0000]">{t.editDetails}</h3>
              <button onClick={() => { setAnnotations(annotations.filter(a => a.id !== editingAnnoId)); setEditingAnnoId(null); }} className="p-2.5 bg-red-600/10 text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18}/></button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto custom-scroll pr-2">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-20 ml-2">{t.modTitle}</label>
                <input autoFocus className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#ff0000]/30 transition-all" value={annotations.find(a => a.id === editingAnnoId)?.title || ''} onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? {...a, title: e.target.value} : a))} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-20 ml-2">{t.chapterName}</label>
                <input className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl text-xs font-bold text-white outline-none focus:border-[#ff0000]/30 transition-all" value={annotations.find(a => a.id === editingAnnoId)?.chapter || ''} onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? {...a, chapter: e.target.value} : a))} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-20 ml-2">Reflection / حكمة</label>
                <textarea className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl text-[11px] font-medium text-white/80 outline-none focus:border-[#ff0000]/30 h-40 resize-none custom-scroll" value={annotations.find(a => a.id === editingAnnoId)?.text || ''} onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? {...a, text: e.target.value} : a))} />
              </div>
              <div className="flex items-center gap-2 pt-4">
                 {COLORS.map(c => (
                   <button 
                     key={c.hex} 
                     onClick={() => setAnnotations(annotations.map(a => a.id === editingAnnoId ? {...a, color: c.hex} : a))}
                     className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${annotations.find(a => a.id === editingAnnoId)?.color === c.hex ? 'border-white' : 'border-transparent'}`}
                     style={{ backgroundColor: c.hex }}
                   />
                 ))}
              </div>
            </div>

            <button onClick={() => setEditingAnnoId(null)} className="mt-8 w-full py-5 bg-[#ff0000] text-white font-black uppercase text-[11px] tracking-[0.4em] rounded-[1.5rem] flex items-center justify-center gap-3 shadow-2xl shadow-red-900/20 active:scale-95 transition-all">
              <Save size={16} /> {t.save}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* شاشة الانتظار السينمائية */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[5000] bg-black flex flex-col items-center justify-center p-10"
          >
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-b-2 border-[#ff0000] rounded-full shadow-[0_0_30px_rgba(255,0,0,0.4)] mb-12"
            />
            <div className="text-center space-y-4 max-w-sm">
              <AnimatePresence mode="wait">
                <motion.p 
                  key={loadingMsgIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-[10px] md:text-xs font-black uppercase tracking-[0.5em] text-white/50 min-h-[1.5em]"
                >
                  {t.loadingMessages[loadingMsgIndex]}
                </motion.p>
              </AnimatePresence>
              <div className="w-48 h-[1px] bg-white/5 rounded-full mx-auto relative overflow-hidden">
                 <motion.div 
                   initial={{ x: '-100%' }}
                   animate={{ x: '100%' }}
                   transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                   className="absolute inset-0 bg-[#ff0000]"
                 />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* المؤقت الأحمر الذكي */}
      <div className={`fixed bottom-2 left-1/2 -translate-x-1/2 z-[1005] transition-opacity duration-1000 ${showControls ? 'opacity-80' : 'opacity-20'}`}>
        <div className={`flex items-center gap-1.5 bg-black/60 px-4 py-1.5 rounded-full border ${isWindowActive ? 'border-[#ff0000]/30' : 'border-white/5 shadow-2xl shadow-red-900/10'}`}>
          {isWindowActive ? (
            <Clock size={8} className={`${isFlowActive ? 'text-[#ff0000] animate-pulse' : 'text-[#ff0000]'}`} />
          ) : (
            <PauseCircle size={8} className="text-white/20" />
          )}
          <span className={`text-[9px] md:text-[11px] font-black tracking-widest uppercase ${isWindowActive ? 'text-[#ff0000]' : 'text-white/20'}`}>
            {sessionMinutes}{lang === 'ar' ? ' د' : 'm'}
            {isFlowActive && isWindowActive && <Zap size={8} className="inline ml-1 mb-0.5" />}
            {!isWindowActive && <span className="ml-1 opacity-50 italic">Paused</span>}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {isSoundPickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[3500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f0f0f] border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl relative text-center">
                <button onClick={() => setIsSoundPickerOpen(false)} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-white/20 hover:text-white transition-all"><X size={18}/></button>
                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="p-4 bg-[#ff0000]/10 rounded-full text-[#ff0000]"><Volume2 size={24} /></div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">{t.soundscape}</h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {SOUNDS.map(sound => (
                    <button 
                      key={sound.id} 
                      onClick={() => { setActiveSoundId(sound.id); setIsSoundPickerOpen(false); }}
                      className={`flex items-center justify-between p-4 rounded-2xl transition-all border ${activeSoundId === sound.id ? 'bg-[#ff0000]/10 border-[#ff0000]/30 text-white' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'}`}
                    >
                      <div className="flex items-center gap-3">
                        <sound.icon size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{(t as any)[sound.id]}</span>
                      </div>
                      {activeSoundId === sound.id && <div className="w-1.5 h-1.5 rounded-full bg-[#ff0000]" />}
                    </button>
                  ))}
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isArchiveOpen && (
          <motion.div initial={{ x: isRTL ? '100%' : '-100%' }} animate={{ x: 0 }} exit={{ x: isRTL ? '100%' : '-100%' }} className={`fixed inset-y-0 ${isRTL ? 'right-0' : 'left-0'} w-full md:w-[450px] z-[2000] bg-[#0a0a0a]/95 backdrop-blur-3xl border-${isRTL ? 'l' : 'r'} border-white/10 shadow-2xl flex flex-col`}>
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
               <h3 className="text-xl md:text-2xl font-black italic tracking-tighter flex items-center gap-4"><ListOrdered size={24} className="text-[#ff0000]" /> {t.wisdomIndex}</h3>
               <button onClick={() => setIsArchiveOpen(false)} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all text-white/50"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-4">
              {annotations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 opacity-10"><Info size={32} className="mb-2" /><p className="text-xs uppercase font-black">{t.noAnnotations}</p></div>
              ) : (
                annotations.sort((a,b) => a.pageIndex - b.pageIndex).map(anno => (
                  <button key={anno.id} onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }} className="w-full text-left p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/[0.08] transition-all flex flex-col gap-2">
                    <div className="flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ff0000]">{anno.type} • {t.page} {anno.pageIndex + 1}</span><div className="w-2 h-2 rounded-full" style={{ backgroundColor: anno.color }} /></div>
                    {anno.chapter && <span className="text-[10px] opacity-40 uppercase font-black tracking-widest">{anno.chapter}</span>}
                    <p className="text-sm font-bold text-white leading-tight">{anno.title || `Entry #${anno.id.slice(0,4)}`}</p>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGoToPageOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[3500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0f0f0f] border border-white/10 p-8 md:p-10 rounded-[2.5rem] w-full max-w-sm shadow-2xl relative text-center">
                <button onClick={() => setIsGoToPageOpen(false)} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-white/20 hover:text-white transition-all"><X size={18}/></button>
                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="p-4 bg-[#ff0000]/10 rounded-full text-[#ff0000]"><Hash size={24} /></div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">{t.goToPage}</h3>
                  <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em]">{t.page} 1 - {totalPages}</p>
                </div>
                <form onSubmit={handleGoToPage} className="flex gap-2">
                  <input autoFocus type="number" min="1" max={totalPages} value={targetPageInput} onChange={(e) => setTargetPageInput(e.target.value)} placeholder="e.g. 42" className="flex-1 bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-black text-center outline-none focus:border-[#ff0000]/50 transition-all" />
                  <button type="submit" className="px-6 bg-[#ff0000] text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all">{t.jump}</button>
                </form>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && (
          <motion.header initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-0 left-0 right-0 flex flex-col gap-2 p-2 md:p-6 bg-gradient-to-b from-black/90 to-transparent z-[1001]">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5 md:gap-3">
                  <button onClick={onBack} className="p-2 md:p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full hover:bg-[#ff0000] text-white/60 hover:text-white transition-all"><ChevronLeft size={18} className={isRTL ? "rotate-180" : ""} /></button>
                  <button onClick={() => setIsArchiveOpen(true)} className="p-2 md:p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-white/40 hover:text-white relative transition-all"><ListOrdered size={20} />{annotations.length > 0 && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#ff0000] rounded-full" />}</button>
                  <button onClick={() => setIsSoundPickerOpen(true)} className={`p-2 md:p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full transition-all ${activeSoundId !== 'none' ? 'text-[#ff0000] border-[#ff0000]/30' : 'text-white/40 hover:text-white'}`}>
                    {activeSoundId === 'none' ? <Volume2 size={18} /> : React.createElement(SOUNDS.find(s => s.id === activeSoundId)!.icon, { size: 18 })}
                  </button>
                </div>
                <div className="flex items-center gap-1 bg-white/5 backdrop-blur-3xl p-1 rounded-full border border-white/10">
                  {[{id: 'view', icon: MousePointer2}, {id: 'highlight', icon: Highlighter}, {id: 'underline', icon: PenTool}, {id: 'box', icon: Square}, {id: 'note', icon: MessageSquare}].map(tool => (
                    <button key={tool.id} onClick={() => setActiveTool(tool.id as Tool)} className={`p-2.5 md:p-3 rounded-full transition-all shrink-0 ${activeTool === tool.id ? 'bg-white text-black shadow-lg' : 'text-white/30 hover:text-white'}`}><tool.icon size={16}/></button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 md:gap-3">
                  <button onClick={toggleZenMode} className={`p-2 md:p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full transition-all ${isZenMode ? 'text-[#ff0000] border-[#ff0000]/30' : 'text-white/40 hover:text-white'}`}>{isZenMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
                  <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-full">
                    <svg className="absolute inset-0 w-full h-full -rotate-90"><circle cx="50%" cy="50%" r="42%" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/5" /><circle cx="50%" cy="50%" r="42%" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="100%" strokeDashoffset={`${100 - starProgress}%`} className="text-[#ff0000] transition-all duration-1000" /></svg>
                    <Star size={16} className="text-[#ff0000] fill-[#ff0000]" />
                  </div>
                </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main className={`flex-1 relative flex items-center justify-center overflow-hidden bg-black transition-all duration-1000 ${isZenMode ? 'p-0' : 'p-2 md:p-10'} ${!isWindowActive ? 'grayscale-[0.5] opacity-50' : ''}`} onTouchStart={(e) => { if (activeTool === 'view') touchStartRef.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (activeTool === 'view' && touchStartRef.current !== null) { const diff = e.changedTouches[0].clientX - touchStartRef.current; if (Math.abs(diff) > 50) { if (isRTL) diff > 0 ? handlePageChange(currentPage + 1) : handlePageChange(currentPage - 1); else diff > 0 ? handlePageChange(currentPage - 1) : handlePageChange(currentPage + 1); } touchStartRef.current = null; } }}>
        <div className="relative h-full w-full flex items-center justify-center z-10">
          {!isLoading && (
            <div ref={pageRef} onMouseDown={(e) => handleStart(e.clientX, e.clientY)} onMouseMove={(e) => handleMove(e.clientX, e.clientY)} onMouseUp={() => handleEnd()} onTouchStart={(e) => { if(activeTool !== 'view') e.preventDefault(); handleStart(e.touches[0].clientX, e.touches[0].clientY, true); }} onTouchMove={(e) => { if(activeTool !== 'view') e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); }} onTouchEnd={(e) => handleEnd(e.changedTouches[0].clientX)} className={`relative shadow-2xl border border-white/5 overflow-hidden transition-all duration-700 touch-none ${activeTool === 'view' ? 'cursor-default' : 'cursor-crosshair'} ${isZenMode ? 'h-full w-auto' : 'max-h-[85vh] h-full w-auto aspect-[1/1.41] bg-white'}`}>
              <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none" alt="Page" />
              
              {isFlowActive && !isDrawing && activeTool === 'view' && isWindowActive && (
                <motion.div 
                   animate={{ y: ["0%", "100%", "0%"] }}
                   transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                   className="absolute left-0 right-0 h-[1px] bg-[#ff0000]/5 shadow-[0_0_10px_rgba(255,0,0,0.1)] pointer-events-none"
                />
              )}

              <div className="absolute inset-0 pointer-events-none">
                {currentPageAnnos.map(anno => (
                  <div key={anno.id} className="absolute group pointer-events-auto cursor-pointer" onClick={() => setEditingAnnoId(anno.id)} style={{ left: `${anno.x}%`, top: `${anno.y}%`, width: anno.width ? `${anno.width}%` : 'auto', height: anno.height ? `${anno.height}%` : 'auto', backgroundColor: anno.type === 'highlight' ? `${anno.color}44` : 'transparent', borderBottom: anno.type === 'underline' ? `3px solid ${anno.color}` : 'none', border: anno.type === 'box' ? `2px solid ${anno.color}` : 'none' }}>
                    {anno.type === 'note' && <button className="w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center bg-[#ff0000] text-white shadow-xl"><MessageSquare size={10} /></button>}
                  </div>
                ))}
                {currentRect && <div className="absolute border-2 border-dashed" style={{ left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: activeTool === 'underline' ? '2px' : `${currentRect.h}%`, backgroundColor: activeTool === 'highlight' ? `${activeColor}22` : 'transparent', borderColor: activeColor }} />}
              </div>

              {!isWindowActive && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-black/80 border border-white/10 px-8 py-4 rounded-full flex items-center gap-4">
                    <PauseCircle className="text-[#ff0000]" size={24} />
                    <span className="text-xs font-black uppercase tracking-widest text-white/60">Session Paused - Return to Focus</span>
                  </motion.div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showControls && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-8 md:bottom-10 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 md:gap-3 bg-black/50 backdrop-blur-3xl border border-white/10 px-4 py-2 rounded-full shadow-2xl scale-[0.85] md:scale-100">
            <div className="flex items-center gap-4 text-white/40">
              <button onClick={() => handlePageChange(currentPage - 1)} className="hover:text-white p-1"><ChevronLeft size={16}/></button>
              <button onClick={() => setIsGoToPageOpen(true)} className="flex items-center gap-1 font-black text-[9px] tracking-widest text-white hover:text-[#ff0000] transition-colors">
                <span>{currentPage + 1}</span><span className="opacity-10">/</span><span className="opacity-30">{totalPages}</span>
              </button>
              <button onClick={() => handlePageChange(currentPage + 1)} className="hover:text-white p-1"><ChevronRight size={16}/></button>
            </div>
            <div className="w-[1px] h-3 bg-white/10" />
            <div className="flex items-center gap-4">
              <div className="flex flex-col min-w-[70px]"><div className="flex justify-between items-center mb-0.5"><span className="text-[6px] font-black uppercase opacity-20">{t.nextStar.split(' ')[0]}</span><span className="text-[7px] font-black text-[#ff0000]">{minsToNextStar}m</span></div><div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden"><motion.div animate={{ width: `${starProgress}%` }} className="h-full bg-[#ff0000]" /></div></div>
              <div className="flex items-center gap-1.5"><Trophy size={10} className="text-yellow-500 opacity-50" /><span className="text-[9px] font-black text-white">{book.stars}</span></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 h-0.5 bg-white/5 z-[1002]"><motion.div className="h-full bg-[#ff0000]/40" animate={{ width: `${progress}%` }} /></div>
    </div>
  );
};
