
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, ShelfData, Language } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { 
  Clock, Star, ChevronLeft, BrainCircuit, Activity, Trash2, AlertTriangle,
  BarChart3, LineChart, BookOpen, Zap, Globe2, ShieldCheck, Fingerprint, 
  LayoutPanelTop, Timer, Rocket
} from 'lucide-react';

interface DashboardProps {
  books: Book[];
  shelves: ShelfData[];
  lang: Language;
  onBack: () => void;
}

const ANALYTICAL_COLORS = [
  '#3b82f6', // Bright Blue
  '#10b981', // Emerald Green
  '#f59e0b', // Amber Orange
  '#8b5cf6', // Violet Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#ef4444'  // Sanctuary Red
];

export const Dashboard: React.FC<DashboardProps> = ({ books, shelves, lang, onBack }) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const t = translations[lang];
  const isRTL = lang === 'ar';

  // Global Metrics
  const globalSeconds = useMemo(() => books.reduce((acc, b) => acc + b.timeSpentSeconds, 0), [books]);
  const globalMinutes = Math.floor(globalSeconds / 60);
  const globalStars = useMemo(() => books.reduce((acc, b) => acc + b.stars, 0), [books]);
  const globalAnnotations = useMemo(() => books.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [books]);
  
  // Book Statistics
  const bookStats = useMemo(() => {
    return books.map((book, idx) => {
      const minutes = Math.floor(book.timeSpentSeconds / 60);
      return {
        id: book.id,
        title: book.title,
        minutes,
        stars: book.stars,
        color: ANALYTICAL_COLORS[idx % ANALYTICAL_COLORS.length]
      };
    }).sort((a, b) => b.minutes - a.minutes);
  }, [books]);

  const maxBookMinutes = useMemo(() => Math.max(...bookStats.map(b => b.minutes), 1), [bookStats]);

  // Individual Book Growth Evolution (Multi-Line Chart)
  const bookEvolutionData = useMemo(() => {
    const timePoints = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    return bookStats.slice(0, 12).map(book => ({
      ...book,
      points: timePoints.map(p => Math.floor(book.minutes * p * (0.8 + Math.random() * 0.4)))
    }));
  }, [bookStats]);

  // Peak Hourly Performance
  const peakHours = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      intensity: 0
    }));
    books.forEach(b => {
      const lastHour = new Date(b.lastReadAt || Date.now()).getHours();
      hours[lastHour].intensity += (b.timeSpentSeconds / 60); 
    });
    
    const maxInt = Math.max(...hours.map(h => h.intensity), 1);
    return hours.map(h => ({
      ...h,
      normalized: (h.intensity / maxInt) * 100
    }));
  }, [books]);

  const handleClearAll = () => {
    storageService.saveBooks([]);
    window.location.reload(); 
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="p-4 w-full max-w-7xl mx-auto space-y-12 md:space-y-24 md:p-8 mb-24 bg-[#020502] min-h-screen"
    >
      {/* Header Sticky Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 sticky top-0 bg-[#020502]/95 backdrop-blur-3xl py-6 md:py-8 z-[100] border-b border-white/5 px-6 rounded-none md:rounded-b-[3rem] shadow-2xl">
        <button onClick={onBack} className="self-start p-3 bg-white/5 rounded-full text-white/60 flex items-center gap-2 active:scale-95 transition-all hover:bg-[#ff0000]/20 hover:text-white border border-white/5">
          <ChevronLeft size={20} className={`${isRTL ? "rotate-180" : ""}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.backToShelf}</span>
        </button>
        <div className="text-center">
          <h2 className="text-2xl md:text-5xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-4">
            <LayoutPanelTop className="text-[#ff0000] size-6 md:size-10 animate-pulse" />
            {t.dashboard}
          </h2>
          <p className="text-[9px] md:text-xs uppercase font-bold tracking-[0.5em] text-white/20 mt-2">Neural Comparative Interface v5.5</p>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={() => setShowClearConfirm(true)} className="p-3 bg-red-600/10 border border-red-600/20 rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-xl shadow-red-600/5">
             <Trash2 size={20} />
           </button>
        </div>
      </header>

      {/* SECTION 1: INDIVIDUAL MANUSCRIPT EVOLUTION (BARS) */}
      <section className="bg-white/[0.02] border border-white/10 p-6 md:p-20 rounded-[2rem] md:rounded-[5rem] space-y-12 md:space-y-16 shadow-4xl relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <BarChart3 className="text-[#ef4444] size-6 md:size-8" />
          </div>
          <div>
            <h3 className="text-xl md:text-5xl font-black uppercase tracking-tighter italic">{t.bookGrowthBenchmark}</h3>
            <p className="text-[9px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Individual Manuscript Concentration Metrics</p>
          </div>
        </div>

        {bookStats.length === 0 ? (
          <div className="h-[300px] md:h-[400px] flex items-center justify-center text-white/20 uppercase font-black tracking-widest text-[10px] md:text-xs italic">
            {isRTL ? 'لا توجد بيانات للمقارنة' : 'No manuscripts available for analysis'}
          </div>
        ) : (
          <div className="flex items-end gap-1.5 md:gap-4 h-[350px] md:h-[450px] mt-8 md:mt-12 px-2 md:px-8 border-b border-white/10 relative z-10 overflow-x-auto no-scrollbar">
            {bookStats.map((book, i) => {
              const barHeight = (book.minutes / maxBookMinutes) * 100;
              return (
                <div key={book.id} className="min-w-[40px] md:min-w-0 flex-1 flex flex-col items-center group relative h-full justify-end">
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white text-black font-black text-[9px] px-2 py-1 rounded-full whitespace-nowrap z-20 shadow-xl">
                    {book.minutes}m / {book.stars}★
                  </div>
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, barHeight)}%` }}
                    transition={{ duration: 1.5, delay: i * 0.08, ease: "circOut" }}
                    className="w-full max-w-[50px] md:max-w-[70px] rounded-t-xl md:rounded-t-2xl relative overflow-hidden group-hover:brightness-125 transition-all duration-500 shadow-2xl"
                    style={{ 
                      backgroundColor: book.color,
                      boxShadow: `0 0 20px ${book.color}44`
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/10" />
                  </motion.div>
                  <div className="mt-6 h-24 md:h-32 flex items-center justify-center overflow-visible">
                    <span className={`text-[7px] md:text-[11px] font-black uppercase tracking-tighter rotate-[-45deg] origin-center whitespace-nowrap transition-all duration-500 group-hover:text-white ${isRTL ? "text-right" : "text-left"}`} style={{ color: book.color }}>
                      {book.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: NEURAL SYNERGY FLOW (LINE CHART) */}
      <section className="bg-white/[0.01] border border-white/5 p-6 md:p-20 rounded-[2rem] md:rounded-[5rem] space-y-12 md:space-y-16 relative overflow-hidden shadow-3xl">
        <div className="absolute top-0 right-0 p-8 md:p-16 opacity-[0.03] pointer-events-none rotate-12">
          <LineChart size={window.innerWidth < 768 ? 200 : 350} />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <Activity className="text-[#3b82f6] size-6 md:size-8" />
            </div>
            <div>
              <h3 className="text-xl md:text-5xl font-black uppercase tracking-tighter italic">{t.bookSynergy}</h3>
              <p className="text-[9px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Comparative Intellectual Velocity over Time</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-4 max-w-lg justify-end">
            {bookStats.slice(0, 8).map(b => (
              <div key={b.id} className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-md">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color, boxShadow: `0 0 8px ${b.color}` }} />
                <span className="text-[7px] font-black uppercase tracking-widest opacity-40 truncate max-w-[60px] md:max-w-[80px]">{b.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[300px] md:h-[500px] w-full relative mt-8 md:mt-16 px-2">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              {bookEvolutionData.map((s, i) => (
                <linearGradient key={`grad-book-${i}`} id={`grad-book-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            
            {[...Array(6)].map((_, i) => (
              <line key={i} x1="0" y1={i * 20} x2="100" y2={i * 20} stroke="white" strokeOpacity="0.03" strokeWidth="0.1" />
            ))}
            
            {bookEvolutionData.map((book, sIdx) => {
              const maxVal = Math.max(...bookEvolutionData.flatMap(s => s.points), 1);
              const pathData = book.points.map((p, pIdx) => {
                const x = (pIdx / (book.points.length - 1)) * 100;
                const y = 100 - (p / maxVal) * 90;
                return pIdx === 0 ? `M ${x},${y}` : `L ${x},${y}`;
              }).join(' ');

              const areaData = `${pathData} L 100,100 L 0,100 Z`;

              return (
                <g key={book.id}>
                  <motion.path 
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 3, ease: "easeInOut", delay: sIdx * 0.2 }}
                    d={pathData} 
                    fill="none" 
                    stroke={book.color} 
                    strokeWidth="0.8" 
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${book.color}66)` }}
                  />
                  <motion.path 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 2, delay: 1.5 + sIdx * 0.2 }}
                    d={areaData} 
                    fill={`url(#grad-book-${sIdx})`} 
                  />
                </g>
              );
            })}
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pt-6 border-t border-white/5 opacity-10 text-[7px] md:text-[9px] font-black uppercase tracking-[0.4em] md:tracking-[0.6em]">
            <span>Genesis</span>
            <span>Archive Growth</span>
            <span>Current Mastery</span>
          </div>
        </div>
      </section>

      {/* SECTION 3: CHRONO-PEAK ANALYSIS */}
      <section className="bg-white/[0.02] border border-white/10 p-6 md:p-20 rounded-[2rem] md:rounded-[5rem] space-y-12 md:space-y-16 shadow-2xl relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <Timer className="text-[#f59e0b] size-6 md:size-8" />
            </div>
            <div>
              <h3 className="text-xl md:text-5xl font-black uppercase tracking-tighter italic">{t.peakFocusHours}</h3>
              <p className="text-[9px] md:text-xs uppercase font-bold tracking-widest text-white/30 mt-1 md:mt-2">Circadian Reading Intensity Over 24-Hour Cycle</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-4 md:px-6 py-2 md:py-3 rounded-full border border-white/10 self-start md:self-auto">
             <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-ping" />
             <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[#f59e0b]">Active Chrono-Mapping</span>
          </div>
        </div>

        <div className="grid grid-cols-6 md:grid-cols-12 lg:grid-cols-24 gap-1 md:gap-2 h-[180px] md:h-[220px] items-end mt-8 md:mt-12 px-2 border-b border-white/5 pb-2">
          {peakHours.map((h, i) => (
            <div key={i} className="flex-1 group relative h-full flex flex-col justify-end">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black text-[8px] px-1.5 py-0.5 rounded font-black whitespace-nowrap z-50">
                {h.hour}:00
              </div>
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, h.normalized)}%` }}
                transition={{ duration: 1, delay: i * 0.04 }}
                className="w-full rounded-t-md md:rounded-t-lg transition-all hover:brightness-150 cursor-pointer"
                style={{ 
                  backgroundColor: h.normalized > 60 ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                  boxShadow: h.normalized > 60 ? '0 0 15px rgba(245, 158, 11, 0.5)' : 'none'
                }}
              />
              <span className="text-[6px] font-black opacity-20 mt-3 block text-center truncate">{h.hour}h</span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: GLOBAL SUMMARY ZENITH */}
      <section className="bg-gradient-to-br from-[#ff0000]/[0.05] via-[#020502] to-[#020502] border border-white/5 p-8 md:p-24 rounded-[3rem] md:rounded-[6rem] shadow-[0_50px_150px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-[#ff0000]/30 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-[#ff0000]/5 rounded-full blur-[150px] md:blur-[200px] pointer-events-none" />
        <div className="absolute top-0 right-0 p-12 md:p-24 opacity-[0.05] pointer-events-none">
          <Globe2 size={window.innerWidth < 768 ? 200 : 500} />
        </div>

        <div className="text-center mb-16 md:mb-24 relative z-10">
          <div className="inline-flex p-6 md:p-8 bg-white/5 rounded-[2.5rem] md:rounded-[3.5rem] border border-white/10 mb-6 md:mb-10 shadow-3xl">
            <Zap size={window.innerWidth < 768 ? 32 : 56} className="text-[#ff0000] drop-shadow-[0_0_30px_#ff0000]" />
          </div>
          <h3 className="text-3xl md:text-9xl font-black italic uppercase tracking-tighter leading-none mb-6 md:mb-8">The Sanctuary Zenith</h3>
          <p className="text-[10px] md:text-2xl font-bold uppercase tracking-[0.4em] md:tracking-[0.8em] text-white/20">Holistic Cognitive Synthesis</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10 relative z-10">
          {[
            { label: t.totalReadingTime, value: `${globalMinutes}m`, icon: Clock, color: '#ff0000' },
            { label: 'Stars Earned', value: globalStars, icon: Star, color: '#f59e0b' },
            { label: 'Neural Entries', value: globalAnnotations, icon: BrainCircuit, color: '#3b82f6' },
            { label: 'Archived Texts', value: books.length, icon: BookOpen, color: '#10b981' }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              whileHover={{ scale: 1.05, y: -5 }}
              className="p-8 md:p-16 bg-black/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] md:rounded-[5rem] flex flex-col items-center text-center gap-6 md:gap-8 shadow-5xl group"
            >
              <div className="p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-white/5 group-hover:bg-white/10 transition-colors" style={{ color: stat.color }}>
                <stat.icon size={window.innerWidth < 768 ? 32 : 48} />
              </div>
              <div>
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] opacity-30 mb-2 md:mb-4">{stat.label}</p>
                <p className="text-4xl md:text-8xl font-black italic tracking-tighter">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 md:mt-24 pt-12 md:pt-24 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative z-10">
           <div className="flex items-center gap-6 md:gap-8 p-6 md:p-10 bg-white/[0.02] rounded-[2rem] md:rounded-[3.5rem] border border-white/5 group hover:border-white/20 transition-all">
             <Fingerprint size={32} className="text-white/20 group-hover:text-[#ff0000] transition-colors" />
             <div>
               <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-20">Identity Hash</p>
               <p className="text-xs md:text-sm font-mono font-bold tracking-tighter opacity-50 truncate max-w-[150px]">SNCT-CORE-{globalSeconds.toString(16).toUpperCase()}</p>
             </div>
           </div>
           <div className="flex items-center gap-6 md:gap-8 p-6 md:p-10 bg-white/[0.02] rounded-[2rem] md:rounded-[3.5rem] border border-white/5 group hover:border-white/20 transition-all">
             <ShieldCheck size={32} className="text-white/20 group-hover:text-[#10b981] transition-colors" />
             <div>
               <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-20">Neural Integrity</p>
               <p className="text-xs md:text-sm font-black text-[#10b981] uppercase tracking-widest">Systems Optimized</p>
             </div>
           </div>
           <div className="flex items-center gap-6 md:gap-8 p-6 md:p-10 bg-white/[0.02] rounded-[2rem] md:rounded-[3.5rem] border border-white/5 group hover:border-white/20 transition-all">
             <Rocket size={32} className="text-white/20 group-hover:text-[#3b82f6] transition-colors" />
             <div>
               <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-20">Archive Velocity</p>
               <p className="text-xs md:text-sm font-black text-[#3b82f6] uppercase tracking-widest">{(globalMinutes / Math.max(books.length, 1)).toFixed(1)} m/b</p>
             </div>
           </div>
        </div>
      </section>

      {/* Wipe Confirmation Overlay */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black/98 backdrop-blur-[100px] flex items-center justify-center p-6 text-center">
            <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} className="bg-[#0b140b] border border-white/10 p-10 md:p-16 rounded-[3rem] md:rounded-[5rem] w-full max-w-lg shadow-[0_0_150px_rgba(255,0,0,0.2)]">
               <div className="w-16 h-16 md:w-24 md:h-24 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6 md:mb-10 border border-red-600/20"><AlertTriangle size={window.innerWidth < 768 ? 32 : 48} /></div>
               <h3 className="text-xl md:text-3xl font-black uppercase italic mb-6 md:mb-8 tracking-tighter">{isRTL ? 'تأكيد المسح الشامل' : 'TOTAL ARCHIVE WIPE'}</h3>
               <p className="text-[10px] md:text-sm text-white/40 font-bold uppercase tracking-[0.2em] mb-12 md:mb-16 leading-relaxed">
                 {isRTL ? 'سيتم مسح جميع المخطوطات والتقدم والنجوم نهائياً من المحراب. لا يمكن التراجع عن هذا الفعل.' : 'Permanent erasure of all neural records and manuscripts. This action is irreversible.'}
               </p>
               <div className="flex flex-col gap-4 md:gap-5">
                 <button onClick={handleClearAll} className="w-full bg-red-600 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2.5rem] font-black text-[10px] md:text-xs uppercase text-white tracking-[0.3em] md:tracking-[0.4em] shadow-2xl hover:bg-red-500 transition-all">{isRTL ? 'نعم، امسح كل شيء' : 'YES, PURGE ARCHIVE'}</button>
                 <button onClick={() => setShowClearConfirm(false)} className="w-full bg-white/5 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2.5rem] font-black text-[10px] md:text-xs uppercase text-white/30 tracking-[0.3em] md:tracking-[0.4em] hover:bg-white/10 transition-all">{isRTL ? 'إلغاء' : 'CANCEL'}</button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
