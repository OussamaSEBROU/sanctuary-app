
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
  Minimize2, Edit3, Award, Layers, LogOut, Sun, Clock, Loader2, Zap, Rocket, Trophy,
  Palette, FileText, Check, Settings2, BoxSelect
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
  box: BoxSelect,
  note: MessageSquare
};

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
  const [activeColor, setActiveColor] = useState(COLORS[0].hex);
  const [annotations, setAnnotations] = useState<Annotation[]>(book.annotations || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [editingAnnoId, setEditingAnnoId] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isGoToPageOpen, setIsGoToPageOpen] = useState(false);
  const [isSoundPickerOpen, setIsSoundPickerOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [activeSoundId, setActiveSoundId] = useState('none');
  const [targetPageInput, setTargetPageInput] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const initialPinchDistance = useRef<number | null>(null);
  const initialScaleOnPinch = useRef<number>(1);
  const timerRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';

  const toggleZenMode = async () => {
    if (!isZenMode) {
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) await docEl.requestFullscreen();
        else if ((docEl as any).webkitRequestFullscreen) await (docEl as any).webkitRequestFullscreen();
      } catch (e) {}
      setIsZenMode(true); setZoomScale(1); setIsToolsOpen(false);
    } else {
      if (document.fullscreenElement) await document.exitFullscreen();
      setIsZenMode(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => { if (!document.fullscreenElement && isZenMode) setIsZenMode(false); };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isZenMode]);

  useEffect(() => {
    if (isZenMode) setShowControls(false);
    else { setShowControls(true); if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current); }
  }, [isZenMode]);

  const handleUserActivity = () => {
    if (!isZenMode) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => { setShowControls(false); }, 4500);
  };

  useEffect(() => {
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
        const loadRest = async () => {
          for (let i = 1; i <= 3; i++) { await renderSinglePage(targetIdx + i); await renderSinglePage(targetIdx - i); }
          for (let i = 0; i < pdf.numPages; i++) { if (!tempPages[i]) await renderSinglePage(i); }
        };
        loadRest();
      } catch (err) {}
    };
    loadPdf();
    timerRef.current = window.setInterval(() => {
      setSessionSeconds(s => s + 1);
      storageService.updateBookStats(book.id, 1);
      onStatsUpdate();
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [book.id]);

  useEffect(() => { storageService.updateBookAnnotations(book.id, annotations); }, [annotations]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setZoomScale(1); setCurrentPage(newPage);
      storageService.updateBookPage(book.id, newPage);
    }
  };

  const playSound = (sound: typeof SOUNDS[0]) => {
    setActiveSoundId(sound.id);
    if (audioRef.current) {
      audioRef.current.pause();
      if (sound.id !== 'none') {
        audioRef.current.src = sound.url;
        audioRef.current.load();
        audioRef.current.play().catch(e => console.error("Sound play blocked", e));
      }
    }
    setIsSoundPickerOpen(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleUserActivity();
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      initialPinchDistance.current = dist; initialScaleOnPinch.current = zoomScale; setIsPinching(true); setIsDrawing(false); 
      return;
    }
    if (activeTool !== 'view' && e.touches.length === 1) handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const newScale = (dist / initialPinchDistance.current) * initialScaleOnPinch.current;
      setZoomScale(Math.max(1, Math.min(newScale, 4))); return;
    }
    if (isDrawing && e.touches.length === 1) handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) { initialPinchDistance.current = null; setIsPinching(false); }
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
      setAnnotations([...annotations, newNote]); setEditingAnnoId(newNote.id); setActiveTool('view'); return;
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
      setAnnotations([...annotations, newAnno]); setEditingAnnoId(newAnno.id);
    }
    setIsDrawing(false); setCurrentRect(null);
  };

  const updateEditingAnnotation = (updates: Partial<Annotation>) => {
    if (!editingAnnoId) return;
    setAnnotations(prev => prev.map(a => a.id === editingAnnoId ? { ...a, ...updates } : a));
  };

  const currentEditingAnno = annotations.find(a => a.id === editingAnnoId);

  return (
    <div onMouseMove={handleUserActivity} onMouseDown={handleUserActivity}
      className={`h-screen flex flex-col bg-black overflow-hidden relative transition-all duration-1000 ${isZenMode && !showControls ? 'cursor-none' : ''} ${fontClass}`} 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <audio ref={audioRef} loop hidden />

      <AnimatePresence>
        {isLoading && (
          <MotionDiv key="loading-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[5000] bg-black flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-12"><MotionDiv animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }} className="w-32 h-32 md:w-48 md:h-48 border border-[#ff0000]/30 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(255,0,0,0.1)]"><Sparkles size={40} className="text-[#ff0000]" /></MotionDiv></div>
            <h3 className="text-xl md:text-2xl font-black uppercase italic text-white/80 tracking-[0.3em] leading-tight">{t.loadingMessages[0]}</h3>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls && (
          <MotionHeader initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} 
            className="fixed top-0 left-0 right-0 p-3 md:p-6 flex items-center justify-between z-[1100] bg-gradient-to-b from-black via-black/40 to-transparent pointer-events-none"
          >
            <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
              {!isZenMode && <button onClick={onBack} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-white/5 rounded-full text-white/60 hover:bg-white/10 active:scale-90"><ChevronLeft size={18} className={isRTL ? "rotate-180" : ""} /></button>}
              <button onClick={() => setIsArchiveOpen(true)} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-white/5 rounded-full text-white/40 hover:bg-white/10 active:scale-90 transition-all group overflow-hidden relative">
                <ListOrdered size={18} />
                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform" />
              </button>
              <button onClick={() => setIsSoundPickerOpen(true)} className={`w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full transition-all active:scale-90 ${activeSoundId !== 'none' ? 'bg-[#ff0000] text-white shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}><Volume2 size={18} /></button>
              <button onClick={() => setIsNightMode(!isNightMode)} className={`w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full transition-all active:scale-90 ${isNightMode ? 'bg-[#ff0000] text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>{isNightMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            </div>

            {isZenMode && (
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-600/10 border border-red-600/30 px-4 py-1.5 rounded-full backdrop-blur-md">
                 <Clock size={12} className="text-red-600 animate-pulse" />
                 <span className="text-[10px] md:text-xs font-black text-red-600 tracking-widest">{Math.floor(sessionSeconds/60)}m</span>
              </div>
            )}

            <div className="flex items-center gap-2 pointer-events-auto">
              <button onClick={() => setIsToolsOpen(!isToolsOpen)} className={`w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full transition-all active:scale-90 ${isToolsOpen ? 'bg-white text-black' : 'bg-white/5 text-white/40'}`}><Palette size={18} /></button>
              <button onClick={toggleZenMode} className={`w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full border transition-all ${isZenMode ? 'bg-red-600 border-red-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}><Maximize2 size={18} /></button>
            </div>
          </MotionHeader>
        )}
      </AnimatePresence>

      <main className="flex-1 flex items-center justify-center bg-black relative overflow-hidden" ref={containerRef}>
        {!isLoading && (
          <div className={`relative w-full h-full flex items-center justify-center overflow-auto no-scrollbar scroll-smooth ${isZenMode ? 'p-0' : 'p-8'}`}>
            <MotionDiv ref={pageRef} drag={activeTool === 'view' && !isPinching} dragConstraints={zoomScale > 1.05 ? undefined : { left: 0, right: 0, top: 0, bottom: 0 }} onDragEnd={(_:any, info:any) => { if (activeTool !== 'view' || isPinching || zoomScale > 1.05) return; const t = 60; if (info.offset.x < -t) handlePageChange(currentPage+1); else if (info.offset.x > t) handlePageChange(currentPage-1); }} onDoubleClick={() => { if (activeTool === 'view') setZoomScale(zoomScale > 1 ? 1 : 2.5); }} onMouseDown={(e: any) => handleStart(e.clientX, e.clientY)} onMouseMove={(e: any) => handleMove(e.clientX, e.clientY)} onMouseUp={handleEnd} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} animate={{ scale: zoomScale }} transition={{ type: 'spring', damping: 40, stiffness: 300 }} className={`relative shadow-2xl overflow-hidden touch-none ${isZenMode ? 'h-full w-full rounded-none' : 'max-h-[80vh] md:max-h-[85vh] w-auto aspect-[1/1.41] rounded-2xl md:rounded-3xl'}`} style={{ backgroundColor: isNightMode ? '#001122' : '#ffffff', transformOrigin: 'center center' }}>
              <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none select-none transition-all duration-500" style={{ filter: isNightMode ? 'invert(1) hue-rotate(180deg)' : 'none' }} alt="Page" />
              <div className="absolute inset-0 pointer-events-none">
                {annotations.filter(a => a.pageIndex === currentPage).map(anno => (
                  <div key={anno.id} className="absolute pointer-events-auto cursor-pointer" onClick={() => setEditingAnnoId(anno.id)}
                    style={{ left: `${anno.x}%`, top: `${anno.y}%`, width: anno.width ? `${anno.width}%` : '0%', height: anno.height ? `${anno.height}%` : '0%', 
                      backgroundColor: anno.type === 'highlight' ? `${anno.color}66` : 'transparent', borderBottom: anno.type === 'underline' ? `3px solid ${anno.color}` : 'none', border: anno.type === 'box' ? `2px solid ${anno.color}` : 'none' }}
                  >
                    {anno.type === 'note' && <div className="w-6 h-6 md:w-8 md:h-8 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-2xl border-2 border-white flex items-center justify-center" style={{ backgroundColor: anno.color }}><MessageSquare size={10} className="md:size-4 text-white" /></div>}
                  </div>
                ))}
                {currentRect && <div className="absolute border-2 border-dashed pointer-events-none" style={{ left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: `${activeTool === 'underline' ? 0.8 : currentRect.h}%`, borderColor: activeColor, backgroundColor: activeTool === 'highlight' ? `${activeColor}33` : 'transparent' }} />}
              </div>
            </MotionDiv>
          </div>
        )}
      </main>

      {/* COMPACT TRIGGER FOR TOOLS */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[2000] pointer-events-none w-full max-w-[420px] px-6">
        <AnimatePresence>
          {isToolsOpen && showControls && (
            <MotionDiv initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="w-full bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-3 pointer-events-auto shadow-[0_30px_100px_rgba(0,0,0,0.7)] flex flex-col gap-4"
            >
              {!isZenMode && (
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-1 bg-white/5 rounded-full px-4 py-2 border border-white/5">
                     <button onClick={() => handlePageChange(currentPage - 1)} className="text-white/30 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
                     <span className="text-[9px] font-black uppercase text-white px-2">{currentPage + 1} / {totalPages}</span>
                     <button onClick={() => handlePageChange(currentPage + 1)} className="text-white/30 hover:text-white transition-colors"><ChevronRight size={16} /></button>
                   </div>
                   <button onClick={() => setIsGoToPageOpen(true)} className="p-3 bg-white/5 rounded-full text-white/40 hover:bg-white/10 transition-all"><Search size={14} /></button>
                </div>
              )}
              <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-2 flex items-center justify-between relative group">
                <div className="flex items-center gap-1.5">
                  {(Object.keys(TOOL_ICONS) as Tool[]).map(tool => {
                    const Icon = TOOL_ICONS[tool];
                    return (
                      <div key={tool} className="relative group/tool">
                        <button onClick={() => setActiveTool(tool)} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-2xl transition-all duration-300 ${activeTool === tool ? 'bg-[#ff0000] text-white shadow-lg' : 'text-white/30 hover:bg-white/5'}`}><Icon size={16} /></button>
                        <AnimatePresence>
                          {activeTool === tool && tool !== 'view' && (
                            <MotionDiv initial={{ y: 10, opacity: 0 }} animate={{ y: -45, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl z-[3000]">
                              {COLORS.slice(0, 5).map(c => (
                                <button key={c.hex} onClick={(e) => { e.stopPropagation(); setActiveColor(c.hex); }} className={`w-4 h-4 rounded-full border ${activeColor === c.hex ? 'border-white scale-110 shadow-sm' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c.hex }} />
                              ))}
                            </MotionDiv>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
                <div className="w-[1px] h-6 bg-white/10 mx-1" />
                <button onClick={() => setIsToolsOpen(false)} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-2xl text-white/30 hover:bg-white/10"><X size={16}/></button>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {editingAnnoId && currentEditingAnno && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6">
            <MotionDiv initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} className="bg-black/40 backdrop-blur-2xl border border-white/10 p-5 rounded-[2.5rem] w-full max-w-[320px] shadow-[0_50px_150px_rgba(0,0,0,0.8)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10" style={{ color: currentEditingAnno.color }}>
                      {currentEditingAnno.type === 'highlight' && <Highlighter size={16} />}{currentEditingAnno.type === 'underline' && <PenTool size={16} />}{currentEditingAnno.type === 'box' && <BoxSelect size={16} />}{currentEditingAnno.type === 'note' && <MessageSquare size={16} />}
                    </div>
                    <div><h3 className="text-xs font-black italic uppercase text-white/90">{isRTL ? 'بيانات التعديل' : 'Intake'}</h3><p className="text-[8px] font-black uppercase text-white/30">{t.page} {currentEditingAnno.pageIndex + 1}</p></div>
                 </div>
                 <button onClick={() => setEditingAnnoId(null)} className="p-2 rounded-full bg-white/5 text-white/30 hover:text-white transition-all"><X size={14} /></button>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto custom-scroll pr-2">
                <input type="text" value={currentEditingAnno.title || ''} onChange={(e) => updateEditingAnnotation({ title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff0000]/50" placeholder="..." />
                <textarea value={currentEditingAnno.text || ''} onChange={(e) => updateEditingAnnotation({ text: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-[10px] font-bold text-white outline-none focus:border-[#ff0000]/50 min-h-[80px] resize-none" placeholder="..." />
                <div className="flex flex-wrap gap-1.5">{COLORS.slice(0,6).map(c => (<button key={c.hex} onClick={() => updateEditingAnnotation({ color: c.hex })} className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${currentEditingAnno.color === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60'}`} style={{ backgroundColor: c.hex }}>{currentEditingAnno.color === c.hex && <Check size={10} className="text-white" />}</button>))}</div>
              </div>
              <div className="flex gap-2.5 mt-4 pt-3 border-t border-white/5">
                <button onClick={() => { setAnnotations(annotations.filter(a => a.id !== editingAnnoId)); setEditingAnnoId(null); }} className="w-10 h-10 bg-red-600/10 border border-red-600/20 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16} /></button>
                <button onClick={() => setEditingAnnoId(null)} className="flex-1 bg-white text-black py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-[#ff0000] hover:text-white transition-all flex items-center justify-center gap-2"><Check size={12} />{isRTL ? 'حفظ' : 'Store'}</button>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSoundPickerOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 pointer-events-auto">
            <div className="bg-[#0b140b] border border-white/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-sm shadow-3xl">
              <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black italic tracking-widest">{t.soundscape}</h3><button onClick={() => setIsSoundPickerOpen(false)} className="hover:text-[#ff0000] transition-colors"><X size={20}/></button></div>
              <div className="grid gap-2">
                {SOUNDS.map(sound => (
                  <button key={sound.id} onClick={() => playSound(sound)} className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${activeSoundId === sound.id ? 'bg-[#ff0000]/20 border-[#ff0000]/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                    <div className="flex items-center gap-3"><sound.icon size={16} className={activeSoundId === sound.id ? "text-[#ff0000]" : "text-white/40"} /><span className="text-[10px] font-bold uppercase tracking-widest">{t[sound.id as keyof typeof t] || sound.id}</span></div>
                    {activeSoundId === sound.id && <div className="w-2 h-2 rounded-full bg-[#ff0000] shadow-[0_0_8px_#ff0000]" />}
                  </button>
                ))}
              </div>
            </div>
          </MotionDiv>
        )}
        {isGoToPageOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 text-center">
            <MotionDiv initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm shadow-5xl">
              <h3 className="text-lg font-black uppercase mb-6 tracking-widest">{t.goToPage}</h3>
              <form onSubmit={jumpToPage}>
                <input autoFocus type="number" value={targetPageInput} onChange={(e) => setTargetPageInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-center text-white outline-none mb-6 focus:border-[#ff0000]/50 shadow-inner" placeholder={`1 - ${totalPages}`} />
                <div className="flex gap-3"><button type="button" onClick={() => setIsGoToPageOpen(false)} className="flex-1 py-3 text-white/30 uppercase font-black text-[9px] tracking-widest">{t.discard}</button><button type="submit" className="flex-1 bg-[#ff0000] py-3 rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-lg">{t.jump}</button></div>
              </form>
            </MotionDiv>
          </MotionDiv>
        )}
        {isArchiveOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-[60px] p-6 flex items-center justify-center pointer-events-auto">
             <MotionDiv initial={{ y: 50 }} animate={{ y: 0 }} className="w-full max-w-xl bg-[#0b140b] border border-white/10 rounded-[2.5rem] p-6 max-h-[75vh] overflow-hidden flex flex-col shadow-4xl">
                <div className="flex justify-between items-center mb-6 bg-white/[0.02] p-3 rounded-xl shrink-0">
                  <h2 className="text-xl font-black italic uppercase tracking-tighter">{t.wisdomIndex}</h2>
                  <button onClick={() => setIsArchiveOpen(false)} className="hover:text-[#ff0000] transition-colors p-1.5 bg-white/5 rounded-full"><X size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scroll space-y-3 pr-2">
                  {annotations.length === 0 ? <p className="text-center opacity-20 py-20 uppercase font-black tracking-widest text-xs">{t.noAnnotations}</p> : 
                    [...annotations].sort((a,b) => a.pageIndex - b.pageIndex).map(anno => (
                    <div key={anno.id} className="p-4 bg-white/[0.03] rounded-xl border border-white/5 hover:border-[#ff0000]/30 transition-all flex items-start justify-between gap-3">
                      <div className="cursor-pointer flex-1" onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: anno.color }} />
                          <span className="text-[9px] font-black text-[#ff0000] uppercase tracking-widest">{t.page} {anno.pageIndex + 1}</span>
                        </div>
                        <h4 className="text-xs font-black text-white/90 truncate">{anno.title || '...'}</h4>
                      </div>
                      <button onClick={() => { setEditingAnnoId(anno.id); setIsArchiveOpen(false); }} className="p-2 text-white/20 hover:text-white transition-all rounded-lg bg-white/5 hover:bg-[#ff0000]/20"><Edit3 size={14} /></button>
                    </div>
                  ))}
                </div>
             </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};
