
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
  Moon, Bird, Flame, VolumeX, Sparkles
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
  { id: 'rain', icon: CloudLightning, url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'sea', icon: Waves, url: '#' },
  { id: 'night', icon: Moon, url: '#' },
  { id: 'birds', icon: Bird, url: '#' },
  { id: 'fire', icon: Flame, url: '#' }
];

export const Reader: React.FC<ReaderProps> = ({ book, lang, onBack, onStatsUpdate }) => {
  const [isZenMode, setIsZenMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(book.lastPage || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  
  const [activeTool, setActiveTool] = useState<Tool>('view');
  const [activeColor, setActiveColor] = useState(COLORS[1].hex);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const t = translations[lang];
  const isRTL = lang === 'ar';
  const fontClass = isRTL ? 'font-ar' : 'font-en';

  // Star Calculation logic
  const totalSeconds = book.timeSpentSeconds;
  const starThreshold = 900; // 15 mins
  const secondsTowardsNextStar = totalSeconds % starThreshold;
  const minsToNextStar = Math.ceil((starThreshold - secondsTowardsNextStar) / 60);

  useEffect(() => {
    const loadPdf = async () => {
      const fileData = await pdfStorage.getFile(book.id);
      if (!fileData) { onBack(); return; }
      try {
        const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;
        setTotalPages(pdf.numPages);
        for (let i = 1; i <= Math.min(pdf.numPages, 300); i++) {
          const p = await pdf.getPage(i);
          const vp = p.getViewport({ scale: 1.5 });
          const cv = document.createElement('canvas');
          cv.height = vp.height; cv.width = vp.width;
          await p.render({ canvasContext: cv.getContext('2d')!, viewport: vp }).promise;
          setPages(prev => [...prev, cv.toDataURL('image/jpeg', 0.8)]);
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

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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

  const deleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
    setEditingAnnoId(null);
  };

  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!pageRef.current) return { x: 0, y: 0 };
    const rect = pageRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
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
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing) return;
    const { x: currentX, y: currentY } = getRelativeCoords(clientX, clientY);
    setCurrentRect({
      x: Math.min(startPos.x, currentX), y: Math.min(startPos.y, currentY),
      w: Math.abs(currentX - startPos.x), h: Math.abs(currentY - startPos.y)
    });
  };

  const handleEnd = () => {
    if (!isDrawing || !currentRect) { setIsDrawing(false); return; }
    const newAnno: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      type: activeTool as any, pageIndex: currentPage, x: currentRect.x, y: currentRect.y,
      width: currentRect.w, height: activeTool === 'underline' ? 0.8 : currentRect.h,
      color: activeColor, text: ''
    };
    setAnnotations([...annotations, newAnno]);
    setIsDrawing(false);
    setCurrentRect(null);
  };

  const currentPageAnnos = annotations.filter(a => a.pageIndex === currentPage);
  const sessionMinutes = Math.floor(sessionSeconds / 60);

  return (
    <div ref={containerRef} className={`h-screen flex flex-col bg-black overflow-hidden relative ${fontClass}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <audio ref={audioRef} loop crossOrigin="anonymous" hidden />

      <AnimatePresence>
        {showControls && (
          <motion.header 
            initial={{ y: -50, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: -50, opacity: 0 }} 
            className="fixed top-0 left-0 right-0 p-4 md:p-8 flex items-center justify-between z-[1100] bg-gradient-to-b from-black/90 to-transparent pointer-events-none"
          >
            <div className="flex items-center gap-3 pointer-events-auto">
              <button onClick={onBack} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full text-white/60 hover:bg-white/10 active:scale-90"><ChevronLeft size={24} className={isRTL ? "rotate-180" : ""} /></button>
              <button onClick={() => setIsArchiveOpen(true)} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full text-white/40 hover:bg-white/10 active:scale-90"><ListOrdered size={24} /></button>
              <button onClick={() => setIsSoundPickerOpen(true)} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full text-white/40 hover:bg-white/10 active:scale-90"><Volume2 size={24} /></button>
            </div>

            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl p-1.5 rounded-full border border-white/10 pointer-events-auto overflow-x-auto no-scrollbar max-w-[50vw]">
              {[{id: 'view', icon: MousePointer2}, {id: 'highlight', icon: Highlighter}, {id: 'underline', icon: PenTool}, {id: 'box', icon: Square}, {id: 'note', icon: MessageSquare}].map(tool => (
                <button 
                  key={tool.id} 
                  onClick={() => setActiveTool(tool.id as Tool)} 
                  className={`p-3 md:p-4 rounded-full transition-all shrink-0 ${activeTool === tool.id ? 'bg-white text-black' : 'text-white/40 hover:bg-white/5'}`}
                >
                  <tool.icon size={18} />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pointer-events-auto">
              <button onClick={() => setIsZenMode(!isZenMode)} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full text-white/40 active:scale-90"><Maximize2 size={24} /></button>
              <div className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full border border-[#ff0000]/30"><Star size={20} className="text-[#ff0000] fill-[#ff0000]" /></div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main className="flex-1 flex items-center justify-center bg-black p-4">
        {!isLoading && (
          <div 
            ref={pageRef} 
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handleEnd}
            className={`relative bg-white shadow-2xl overflow-hidden transition-all ${isZenMode ? 'h-full w-auto aspect-[1/1.41]' : 'max-h-[85vh] w-auto aspect-[1/1.41]'}`}
          >
            <img src={pages[currentPage]} className="w-full h-full object-contain pointer-events-none" alt="Page" />
            <div className="absolute inset-0 pointer-events-none">
              {currentPageAnnos.map(anno => (
                <div 
                  key={anno.id} 
                  className="absolute pointer-events-auto" 
                  onClick={() => setEditingAnnoId(anno.id)}
                  style={{ 
                    left: `${anno.x}%`, top: `${anno.y}%`, 
                    width: anno.width ? `${anno.width}%` : 'auto', 
                    height: anno.height ? `${anno.height}%` : 'auto', 
                    backgroundColor: anno.type === 'highlight' ? `${anno.color}44` : 'transparent',
                    borderBottom: anno.type === 'underline' ? `2px solid ${anno.color}` : 'none',
                    border: anno.type === 'box' ? `1px solid ${anno.color}` : 'none'
                  }}
                >
                  {anno.type === 'note' && <div className="w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff0000] text-white flex items-center justify-center shadow-lg"><MessageSquare size={12} /></div>}
                </div>
              ))}
              {currentRect && (
                <div 
                  className="absolute border border-dashed border-[#ff0000] bg-[#ff0000]/10" 
                  style={{ left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: `${currentRect.h}%` }} 
                />
              )}
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 50, opacity: 0 }} 
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1100] flex items-center gap-4 bg-black/80 backdrop-blur-2xl border border-white/10 px-6 py-3 rounded-full shadow-2xl scale-[0.9] md:scale-100"
          >
            <button onClick={() => handlePageChange(currentPage - 1)} className="p-2 text-white/40 hover:text-white active:scale-90"><ChevronLeft size={24}/></button>
            
            <button 
              onClick={() => setIsGoToPageOpen(true)} 
              className="px-4 text-[10px] md:text-sm font-black tracking-widest text-white uppercase hover:text-[#ff0000] transition-colors"
            >
              {currentPage + 1} / {totalPages}
            </button>
            
            <button onClick={() => handlePageChange(currentPage + 1)} className="p-2 text-white/40 hover:text-white active:scale-90"><ChevronRight size={24}/></button>
            
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-[#ff0000]" />
                  <span className="text-[10px] font-black">{sessionMinutes}m</span>
               </div>
               <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                  <Sparkles size={14} className="text-[#ff0000] animate-pulse" />
                  <span className="text-[10px] font-black text-[#ff0000]">{minsToNextStar}m</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isArchiveOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl p-6 overflow-y-auto">
             <div className="max-w-3xl mx-auto py-10">
                <div className="flex items-center justify-between mb-10">
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-4"><ListOrdered className="text-[#ff0000]" /> {t.wisdomIndex}</h2>
                  <button onClick={() => setIsArchiveOpen(false)} className="w-12 h-12 flex items-center justify-center bg-white/5 rounded-full"><X size={24}/></button>
                </div>
                <div className="grid gap-4">
                  {annotations.length === 0 ? (
                    <p className="text-center py-20 opacity-20 uppercase font-black tracking-widest">{t.noAnnotations}</p>
                  ) : (
                    annotations.map(anno => (
                      <div key={anno.id} className="p-6 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group">
                        <div onClick={() => { handlePageChange(anno.pageIndex); setIsArchiveOpen(false); }} className="cursor-pointer flex-1">
                          <div className="flex items-center gap-3 mb-2">
                             <div className="px-3 py-1 bg-[#ff0000]/10 text-[#ff0000] text-[10px] font-black rounded-md">{t.page} {anno.pageIndex + 1}</div>
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: anno.color }} />
                          </div>
                          <p className="text-sm text-white/60 line-clamp-2">{anno.text || `[${anno.type.toUpperCase()}]`}</p>
                        </div>
                        <button onClick={() => deleteAnnotation(anno.id)} className="p-3 text-white/10 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
                      </div>
                    ))
                  )}
                </div>
             </div>
          </motion.div>
        )}

        {isGoToPageOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 rounded-[2.5rem] w-full max-w-sm shadow-3xl text-center">
              <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8">{t.goToPage}</h3>
              <form onSubmit={jumpToPage}>
                <input 
                  autoFocus
                  type="number" 
                  value={targetPageInput} 
                  onChange={(e) => setTargetPageInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-2xl font-black text-center text-white outline-none focus:border-[#ff0000]/50 mb-8"
                  placeholder={`1 - ${totalPages}`}
                />
                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsGoToPageOpen(false)} className="flex-1 bg-white/5 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">{t.discard}</button>
                  <button type="submit" className="flex-1 bg-[#ff0000] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-xl">{t.jump}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isSoundPickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6">
            <div className="bg-[#0b140b] border border-white/10 p-10 rounded-[3rem] w-full max-w-md shadow-3xl">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">{t.soundscape}</h3>
                <button onClick={() => setIsSoundPickerOpen(false)} className="p-2 text-white/40"><X size={24}/></button>
              </div>
              <div className="grid gap-3">
                {SOUNDS.map(sound => (
                  <button 
                    key={sound.id} 
                    onClick={() => { 
                      setActiveSoundId(sound.id); 
                      if (audioRef.current) {
                        if (sound.id === 'none') { audioRef.current.pause(); }
                        else { audioRef.current.src = sound.url; audioRef.current.play().catch(e => console.warn(e)); }
                      }
                      setIsSoundPickerOpen(false); 
                    }} 
                    className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${activeSoundId === sound.id ? 'bg-[#ff0000]/10 border-[#ff0000]/30 text-white' : 'bg-white/5 border-transparent text-white/30 hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-4">
                      <sound.icon size={20} />
                      <span className="text-xs font-black uppercase tracking-widest">{t[sound.id as keyof typeof t] || sound.id}</span>
                    </div>
                    {activeSoundId === sound.id && <div className="w-2 h-2 rounded-full bg-[#ff0000]" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {editingAnnoId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2100] bg-black/95 flex items-center justify-center p-6">
            <div className="bg-[#0b140b] border border-white/10 p-10 rounded-[3rem] w-full max-w-xl">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black uppercase italic">{t.editDetails}</h3>
                <button onClick={() => setEditingAnnoId(null)} className="p-2"><X size={24}/></button>
              </div>
              <textarea 
                autoFocus
                value={annotations.find(a => a.id === editingAnnoId)?.text || ''}
                onChange={(e) => setAnnotations(annotations.map(a => a.id === editingAnnoId ? { ...a, text: e.target.value } : a))}
                className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white outline-none focus:border-[#ff0000]/30 mb-8"
                placeholder="..."
              />
              <div className="flex gap-4">
                <button onClick={() => deleteAnnotation(editingAnnoId)} className="flex-1 bg-red-600/10 text-red-600 py-4 rounded-2xl font-black uppercase text-xs">{t.discard}</button>
                <button onClick={() => setEditingAnnoId(null)} className="flex-1 bg-white text-black py-4 rounded-2xl font-black uppercase text-xs">{t.save}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
