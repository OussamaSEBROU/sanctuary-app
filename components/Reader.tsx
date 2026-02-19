
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Language, Annotation } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { pdfStorage } from '../services/pdfStorage';
import { 
  ChevronLeft, ChevronRight, Maximize2, Highlighter, 
  PenTool, MessageSquare, Trash2, X, MousePointer2, 
  ListOrdered, Volume2, CloudLightning, Waves, 
  Moon, Bird, Flame, VolumeX, Sparkles, Search, Droplets,
  Edit3, Sun, Clock, BoxSelect, Palette, Check, LayoutGrid,
  FileAudio, Star
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

const INTELLECTUAL_QUOTES = [
  { ar: "إن المعرفة ليست ترفاً، بل هي ضرورة وجودية للارتقاء فوق منطق القطيع.", en: "Knowledge is not a luxury, but an existential necessity to rise above the herd logic." },
  { ar: "القراءة هي الحوار المستمر مع العقول العظيمة عبر العصور.", en: "Reading is a continuous dialogue with great minds across the ages." },
  { ar: "كل نجمة هي شعلة وعي تضيء ظلمات الجهل في محرابك الخاص.", en: "Every star is a flame of consciousness illuminating the darkness of ignorance in your sanctuary." },
  { ar: "لا نصل إلى الحقيقة إلا بالصبر على مشقة الفهم.", en: "We only reach truth through patience with the hardship of understanding." },
  { ar: "الفكر هو السلاح الوحيد الذي لا يصدأ في معركة الوعي.", en: "Thought is the only weapon that does not rust in the battle of consciousness." }
];

export const Reader: React.FC<ReaderProps> = ({ book, lang, onBack, onStatsUpdate }) => {
  const [isZenMode, setIsZenMode] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
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
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(false);
  const [activeSoundId, setActiveSoundId] = useState('none');
  const [customSoundName, setCustomSoundName] = useState('');
  const [targetPageInput, setTargetPageInput] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [direction, setDirection] = useState(0); 
  const [showCelebration, setShowCelebration] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(INTELLECTUAL_QUOTES[0]);
  
  const initialPinchDistance = useRef<number | null>(null);
  const initialScaleOnPinch = useRef<number>(1);
  const timerRef = useRef<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';

  useEffect(() => {
    const loadPdf = async () => {
      const fileData = await pdfStorage.getFile(book.id);
      if (!fileData) { onBack(); return; }
      try {
        const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;
        setTotalPages(pdf.numPages);
        const tempPages = new Array(pdf.numPages).fill(null);
        const renderSinglePage = async (idx: number) => {
          if (idx < 0 || idx >= pdf.numPages || tempPages[idx]) return;
          const p = await pdf.getPage(idx + 1);
          const vp = p.getViewport({ scale: 1.5 });
          const cv = document.createElement('canvas');
          cv.height = vp.height; cv.width = vp.width;
          await p.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
          tempPages[idx] = cv.toDataURL('image/jpeg', 0.8);
          setPages([...tempPages]);
        };
        await renderSinglePage(currentPage);
        setIsLoading(false);
        const loadRest = async () => {
          for (let i = 0; i < pdf.numPages; i++) {
            if (!tempPages[i]) await renderSinglePage(i);
          }
        };
        loadRest();
      } catch (err) {}
    };
    loadPdf();
    timerRef.current = window.setInterval(() => {
      setSessionSeconds(s => s + 1);
      const achievedStar = storageService.updateBookStats(book.id, 1);
      if (achievedStar) {
        setCurrentQuote(INTELLECTUAL_QUOTES[Math.floor(Math.random() * INTELLECTUAL_QUOTES.length)]);
        setShowCelebration(true);
        const celebAudio = new Audio('/assets/sounds/celebration.mp3');
        celebAudio.play().catch(e => console.warn("Celebration audio error:", e));
        setTimeout(() => setShowCelebration(false), 10000);
      }
      onStatsUpdate();
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [book.id]);

  useEffect(() => { storageService.updateBookAnnotations(book.id, annotations); onStatsUpdate(); }, [annotations]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages && newPage !== currentPage) {
      setDirection(newPage > currentPage ? 1 : -1);
      setZoomScale(1);
      setCurrentPage(newPage);
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
        audioRef.current.play().catch(e => console.warn("Audio feedback:", e));
      }
    }
    setIsSoundPickerOpen(false);
  };

  const handleUserActivity = () => {
    if (!isZenMode) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => { setShowControls(false); }, 4500);
  };

  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!pageRef.current) return { x: 0, y: 0 };
    const rect = pageRef.current.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, rawX)), y: Math.max(0, Math.min(100, rawY)) };
  };

  const handleStart = (clientX: number, clientY: number) => {
    if (activeTool === 'view' || isPinching) return;
    const { x, y } = getRelativeCoords(clientX, clientY);
    if (activeTool === 'note') {
      const newAnno: Annotation = { id: Math.random().toString(36).substr(2, 9), type: 'note', pageIndex: currentPage, x, y, color: activeColor, text: '' };
      setAnnotations([...annotations, newAnno]); setEditingAnnoId(newAnno.id); return;
    }
    setIsDrawing(true); setStartPos({ x, y }); setCurrentRect({ x, y, w: 0, h: 0 });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing) return;
    const { x: currentX, y: currentY } = getRelativeCoords(clientX, clientY);
    setCurrentRect({ x: Math.min(startPos.x, currentX), y: Math.min(startPos.y, currentY), w: Math.abs(currentX - startPos.x), h: Math.abs(currentY - startPos.y) });
  };

  const handleEnd = () => {
    if (!isDrawing || !currentRect || currentRect.w < 1 || currentRect.h < 1) { setIsDrawing(false); setCurrentRect(null); return; }
    const newAnno: Annotation = { id: Math.random().toString(36).substr(2, 9), type: activeTool as any, pageIndex: currentPage, x: currentRect.x, y: currentRect.y, width: currentRect.w, height: currentRect.h, color: activeColor };
    setAnnotations([...annotations, newAnno]); setIsDrawing(false); setCurrentRect(null);
  };

  const currentEditingAnno = annotations.find(a => a.id === editingAnnoId);
  const updateEditingAnnotation = (updates: Partial<Annotation>) => {
    setAnnotations(annotations.map(a => a.id === editingAnnoId ? { ...a, ...updates } : a));
  };

  return (
    <div className={`fixed inset-0 bg-[#050505] flex flex-col overflow-hidden select-none ${fontClass} ${isNightMode ? 'brightness-75' : ''}`} onMouseMove={handleUserActivity} onTouchStart={() => handleUserActivity()}>
      <audio ref={audioRef} loop />
      <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && audioRef.current) {
          const url = URL.createObjectURL(file);
          setCustomSoundName(file.name);
          setActiveSoundId('custom');
          audioRef.current.src = url;
          audioRef.current.load();
          audioRef.current.play().catch(e => console.warn("Audio feedback:", e));
          setIsSoundPickerOpen(false);
        }
      }} />

      <AnimatePresence>
        {showControls && (
          <MotionHeader initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }} className="absolute top-0 left-0 right-0 z-[4000] p-4 md:p-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <button onClick={onBack} className="p-3 md:p-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white hover:bg-red-600/20 transition-all pointer-events-auto active:scale-90"><ChevronLeft size={20} /></button>
            <div className="flex items-center gap-2 md:gap-4 pointer-events-auto">
              <div className="px-4 md:px-6 py-2 md:py-3 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                <span className="text-[10px] md:text-xs font-black text-white/80 uppercase tracking-widest truncate max-w-[120px] md:max-w-xs">{book.title}</span>
              </div>
              <button onClick={() => setIsArchiveOpen(true)} className="p-3 md:p-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white transition-all active:scale-90"><ListOrdered size={20} /></button>
            </div>
          </MotionHeader>
        )}
      </AnimatePresence>

      <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden touch-none" onMouseDown={(e) => handleStart(e.clientX, e.clientY)} onMouseMove={(e) => handleMove(e.clientX, e.clientY)} onMouseUp={handleEnd} onTouchStart={(e) => {
        if (e.touches.length === 2) {
          const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
          initialPinchDistance.current = dist; initialScaleOnPinch.current = zoomScale; setIsPinching(true); setIsDrawing(false); 
        } else if (activeTool !== 'view') handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }} onTouchMove={(e) => {
        if (e.touches.length === 2 && initialPinchDistance.current !== null) {
          const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
          setZoomScale(Math.max(1, Math.min((dist / initialPinchDistance.current) * initialScaleOnPinch.current, 4)));
        } else if (isDrawing) handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }} onTouchEnd={() => { setIsPinching(false); initialPinchDistance.current = null; handleEnd(); }}>
        
        <AnimatePresence mode="wait">
          <MotionDiv key={currentPage} initial={{ opacity: 0, x: direction * 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -direction * 50 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="relative shadow-2xl" style={{ scale: zoomScale }}>
            <div ref={pageRef} className="relative bg-white overflow-hidden" style={{ width: 'min(90vw, 800px)', aspectRatio: '1/1.414' }}>
              {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
                  <div className="w-12 h-12 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">{t.loadingNote}</span>
                </div>
              ) : (
                <>
                  <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none" alt={`Page ${currentPage + 1}`} />
                  <div className="absolute inset-0 pointer-events-none">
                    {annotations.filter(a => a.pageIndex === currentPage).map(anno => (
                      <div key={anno.id} className="absolute border-2 pointer-events-auto cursor-pointer group" style={{ left: `${anno.x}%`, top: `${anno.y}%`, width: anno.type === 'note' ? '24px' : `${anno.width}%`, height: anno.type === 'note' ? '24px' : `${anno.height}%`, borderColor: anno.type === 'underline' ? 'transparent' : anno.color, borderBottomColor: anno.color, backgroundColor: anno.type === 'highlight' ? `${anno.color}33` : 'transparent' }} onClick={(e) => { e.stopPropagation(); setEditingAnnoId(anno.id); }}>
                        {anno.type === 'note' && <div className="w-full h-full flex items-center justify-center bg-white shadow-lg rounded-full" style={{ color: anno.color }}><MessageSquare size={12} fill="currentColor" /></div>}
                      </div>
                    ))}
                    {isDrawing && currentRect && (
                      <div className="absolute border-2 border-dashed" style={{ left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: `${currentRect.h}%`, borderColor: activeColor, backgroundColor: activeTool === 'highlight' ? `${activeColor}33` : 'transparent' }} />
                    )}
                  </div>
                </>
              )}
            </div>
          </MotionDiv>
        </AnimatePresence>

        <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center pointer-events-none">
          <button onClick={() => handlePageChange(currentPage - 1)} className="p-4 text-white/10 hover:text-white/40 transition-all pointer-events-auto active:scale-75"><ChevronLeft size={40} /></button>
        </div>
        <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center pointer-events-none">
          <button onClick={() => handlePageChange(currentPage + 1)} className="p-4 text-white/10 hover:text-white/40 transition-all pointer-events-auto active:scale-75"><ChevronRight size={40} /></button>
        </div>
      </div>

      <AnimatePresence>
        {showControls && (
          <MotionDiv initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute bottom-0 left-0 right-0 z-[4000] p-6 md:p-10 flex flex-col items-center gap-6 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
            <div className="flex items-center gap-3 md:gap-6 pointer-events-auto">
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-2xl p-1.5 rounded-full border border-white/10">
                {(Object.entries(TOOL_ICONS) as [Tool, any][]).map(([type, Icon]) => (
                  <button key={type} onClick={() => setActiveTool(type)} className={`p-3 md:p-4 rounded-full transition-all active:scale-90 ${activeTool === type ? 'bg-white text-black shadow-xl' : 'text-white/40 hover:text-white hover:bg-white/5'}`}><Icon size={18} /></button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-2xl p-1.5 rounded-full border border-white/10">
                {COLORS.map(c => (<button key={c.hex} onClick={() => setActiveColor(c.hex)} className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all active:scale-90 ${activeColor === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`} style={{ backgroundColor: c.hex }} />))}
              </div>
            </div>
            <div className="flex items-center gap-4 md:gap-8 pointer-events-auto">
              <button onClick={() => setIsSoundPickerOpen(true)} className={`p-4 rounded-full backdrop-blur-2xl border transition-all active:scale-90 ${activeSoundId !== 'none' ? 'bg-red-600 border-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}><Volume2 size={20} /></button>
              <div className="px-8 py-4 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 flex items-center gap-6">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">{currentPage + 1} / {totalPages}</span>
                <div className="w-32 md:w-48 h-1 bg-white/5 rounded-full overflow-hidden"><motion.div className="h-full bg-red-600" initial={{ width: 0 }} animate={{ width: `${((currentPage + 1) / totalPages) * 100}%` }} /></div>
              </div>
              <button onClick={toggleZenMode} className={`p-4 rounded-full backdrop-blur-2xl border transition-all active:scale-90 ${isZenMode ? 'bg-white border-white text-black shadow-xl' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}><Maximize2 size={20} /></button>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCelebration && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}>
            <MotionDiv initial={{ scale: 0.8, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative p-10 md:p-16 rounded-[4rem] bg-gradient-to-br from-white/15 to-white/5 border border-white/20 shadow-[0_0_100px_rgba(255,255,255,0.15)] text-center max-w-2xl mx-4 overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
              <motion.div animate={{ rotateY: [0, 360], scale: [1, 1.1, 1], filter: ["drop-shadow(0 0 20px rgba(255,215,0,0.4))", "drop-shadow(0 0 40px rgba(255,215,0,0.8))", "drop-shadow(0 0 20px rgba(255,215,0,0.4))"] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="mb-10 flex justify-center relative z-10">
                <Star size={120} className="text-yellow-400 fill-yellow-400" />
              </motion.div>
              <h2 className="text-4xl md:text-7xl font-black text-white mb-8 tracking-tighter italic uppercase relative z-10 drop-shadow-2xl">{isRTL ? 'ارتقاء معرفي' : 'INTELLECTUAL ASCENT'}</h2>
              <p className="text-xl md:text-3xl font-bold text-white/95 leading-relaxed italic font-serif relative z-10 px-4">"{isRTL ? currentQuote.ar : currentQuote.en}"</p>
              <div className="mt-12 flex justify-center gap-4 relative z-10">
                {[...Array(5)].map((_, i) => (<motion.div key={i} animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.5, 1] }} transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)]" />))}
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isArchiveOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6">
            <MotionDiv initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3rem] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-white uppercase tracking-widest italic">{t.wisdomIndex}</h2>
                <button onClick={() => setIsArchiveOpen(false)} className="p-3 rounded-full bg-white/5 text-white/40 hover:text-white transition-all"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scroll pr-4 space-y-4">
                {annotations.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-white/20 font-bold uppercase tracking-widest">{t.noAnnotations}</div>
                ) : (
                  annotations.map(anno => (
                    <div key={anno.id} className="p-6 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-red-600/30 transition-all flex items-start justify-between gap-4 group cursor-pointer" onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: anno.color }} />
                          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{t.page} {anno.pageIndex + 1}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1">{anno.title || (isRTL ? 'تعديل بدون عنوان' : 'Untitled Entry')}</h4>
                        {anno.text && <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{anno.text}</p>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setAnnotations(annotations.filter(a => a.id !== anno.id)); }} className="p-2 text-white/0 group-hover:text-white/20 hover:text-red-600 transition-all"><Trash2 size={16} /></button>
                    </div>
                  ))
                )}
              </div>
            </MotionDiv>
          </MotionDiv>
        )}

        {isSoundPickerOpen && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6">
            <MotionDiv initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3rem] w-full max-w-md">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-white uppercase tracking-widest italic">{t.soundscape}</h2>
                <button onClick={() => setIsSoundPickerOpen(false)} className="p-3 rounded-full bg-white/5 text-white/40 hover:text-white transition-all"><X size={24} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SOUNDS.map(s => (
                  <button key={s.id} onClick={() => playSound(s)} className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 ${activeSoundId === s.id ? 'bg-red-600 border-red-600 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}>
                    <s.icon size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{(t as any)[s.id]}</span>
                  </button>
                ))}
                <button onClick={() => audioInputRef.current?.click()} className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 col-span-2 ${activeSoundId === 'custom' ? 'bg-red-600 border-red-600 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}>
                  <FileAudio size={24} />
                  <span className="text-[10px] font-black uppercase tracking-widest truncate w-full text-center">{customSoundName || t.uploadCustomSound}</span>
                </button>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}

        {editingAnnoId && currentEditingAnno && (
          <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
            <MotionDiv initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white/5 border border-white/10 p-8 rounded-[3rem] w-full max-w-md shadow-5xl flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black uppercase text-white italic">{t.editDetails}</h3>
                <button onClick={() => setEditingAnnoId(null)} className="p-2 rounded-full bg-white/5 text-white/30 hover:text-white"><X size={20}/></button>
              </div>
              <div className="space-y-4">
                <input type="text" value={currentEditingAnno.title || ''} onChange={(e) => updateEditingAnnotation({ title: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:border-red-600/50" placeholder={t.modTitle} />
                <textarea value={currentEditingAnno.text || ''} onChange={(e) => updateEditingAnnotation({ text: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:border-red-600/50 min-h-[120px] resize-none" placeholder={isRTL ? 'ملاحظات استخلاص الحكمة...' : 'Wisdom Notes...'} />
                <div className="flex flex-wrap gap-2">{COLORS.map(c => (<button key={c.hex} onClick={() => updateEditingAnnotation({ color: c.hex })} className={`w-8 h-8 rounded-full border-2 transition-all ${currentEditingAnno.color === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40'}`} style={{ backgroundColor: c.hex }} />))}</div>
              </div>
              <div className="flex gap-3 mt-8 pt-6 border-t border-white/5">
                <button onClick={() => { setAnnotations(annotations.filter(a => a.id !== editingAnnoId)); setEditingAnnoId(null); }} className="p-4 bg-red-600/10 border border-red-600/20 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={20}/></button>
                <button onClick={() => setEditingAnnoId(null)} className="flex-1 bg-white text-black py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"><Check size={16}/>{t.save}</button>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};

const TOOL_ICONS = {
  view: MousePointer2,
  highlight: Highlighter,
  underline: PenTool,
  box: BoxSelect,
  note: MessageSquare
};
