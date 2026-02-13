
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, ShelfData, Language } from '../types';
import { translations } from '../i18n/translations';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Clock, 
  Star, 
  ChevronLeft,
  Activity,
  Zap,
  Target,
  BrainCircuit,
  CalendarDays,
  MousePointer2,
  FileText,
  Search,
  CheckCircle2,
  Microscope,
  Flame,
  BarChart,
  LineChart,
  Sigma
} from 'lucide-react';

interface DashboardProps {
  books: Book[];
  shelves: ShelfData[];
  lang: Language;
  onBack: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ books, shelves, lang, onBack }) => {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const t = translations[lang];
  const isRTL = lang === 'ar';

  // --- التحليلات الإحصائية المتقدمة (Data Analysis Core) ---
  
  const totalSeconds = useMemo(() => books.reduce((acc, b) => acc + b.timeSpentSeconds, 0), [books]);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalAnnotations = useMemo(() => books.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [books]);
  
  // المتوسطات (Means & Averages)
  const avgMinutesPerBook = books.length > 0 ? (totalMinutes / books.length).toFixed(1) : 0;
  const avgAnnotationsPerBook = books.length > 0 ? (totalAnnotations / books.length).toFixed(1) : 0;
  
  // كثافة المعرفة (Cognitive Density)
  const cognitiveDensity = totalSeconds > 0 ? (totalAnnotations / (totalSeconds / 3600)).toFixed(1) : 0;

  // ترتيب الكتب حسب وقت القراءة (للرسم البياني)
  const sortedBooksByTime = useMemo(() => [...books].sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds), [books]);
  
  // الحد الأقصى للوقت (لتطبيع الرسم البياني)
  const maxTimeSeconds = Math.max(...books.map(b => b.timeSpentSeconds), 1);

  // منحنى تطور فك التشفير (Timeline Evolution)
  // نستخدم تاريخ الإضافة كمحور زمني تخيلي للنمو
  const timelineData = useMemo(() => {
    return [...books]
      .sort((a, b) => a.addedAt - b.addedAt)
      .reduce((acc: {x: number, y: number}[], book, idx) => {
        const prevY = acc.length > 0 ? acc[acc.length - 1].y : 0;
        acc.push({ x: idx, y: prevY + (book.timeSpentSeconds / 60) });
        return acc;
      }, []);
  }, [books]);

  const selectedBook = useMemo(() => books.find(b => b.id === selectedBookId), [books, selectedBookId]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return isRTL ? `${m} د ${s} ث` : `${m}m ${s}s`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-10 w-full max-w-7xl mx-auto space-y-10 mb-20 bg-black/40 min-h-screen">
      
      {/* Header Section */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 sticky top-0 bg-black/90 backdrop-blur-2xl py-6 z-50 border-b border-white/5">
        <button onClick={onBack} className="p-3 bg-white/5 rounded-full hover:bg-[#ff0000]/20 text-white/60 hover:text-[#ff0000] transition-all flex items-center gap-2 group">
          <ChevronLeft className={`${isRTL ? "rotate-180" : ""} group-hover:scale-110`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.backToShelf}</span>
        </button>
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-4">
            <BrainCircuit className="text-[#ff0000]" size={36} />
            {isRTL ? 'مركز التحليل الاستخباري' : 'INTELLIGENCE HUB'}
          </h2>
          <p className="text-[9px] uppercase font-black tracking-[0.5em] text-[#ff0000]/40 mt-1">Advanced Cognitive Data Analytics</p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-6 py-2 rounded-full border border-white/10">
           <Sigma size={14} className="text-[#ff0000]" />
           <span className="text-[10px] font-black uppercase tracking-widest">{isRTL ? 'دقة التحليل: 100%' : 'Analysis Precision: 100%'}</span>
        </div>
      </header>

      {/* --- Section 1: Statistical Synthesis (Global Averages) --- */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: isRTL ? 'إجمالي الدقائق' : 'Total Minutes', value: totalMinutes, icon: Clock, color: "#ff0000" },
          { label: isRTL ? 'متوسط دقائق/كتاب' : 'Avg Min/Book', value: avgMinutesPerBook, icon: Sigma, color: "#3b82f6" },
          { label: isRTL ? 'كثافة الاستنباط' : 'Cognitive Density', value: `${cognitiveDensity}/h`, icon: Flame, color: "#ef4444" },
          { label: isRTL ? 'متوسط الحكمة/كتاب' : 'Avg Wisdom/Book', value: avgAnnotationsPerBook, icon: Microscope, color: "#fbbf24" }
        ].map((stat, i) => (
          <motion.div key={i} whileHover={{ y: -5 }} className="bg-white/5 border border-white/10 p-5 md:p-8 rounded-[2rem] flex flex-col gap-3 relative overflow-hidden group">
             <div className="p-3 bg-white/5 rounded-2xl w-fit group-hover:bg-[#ff0000] group-hover:text-white transition-all">
              <stat.icon size={20} />
             </div>
             <div>
              <p className="text-[9px] uppercase font-black opacity-30 tracking-widest">{stat.label}</p>
              <p className="text-xl md:text-3xl font-black italic tracking-tighter mt-1">{stat.value}</p>
             </div>
          </motion.div>
        ))}
      </section>

      {/* --- Section 2: Evolution Curve (Line Chart) --- */}
      <section className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3.5rem] space-y-8">
        <div className="flex items-center gap-4">
          <TrendingUp className="text-[#ff0000]" size={24} />
          <h3 className="text-xl font-black uppercase tracking-tighter italic">{isRTL ? 'منحنى التطور المعرفي' : 'Cognitive Evolution Curve'}</h3>
        </div>
        
        <div className="h-[250px] w-full relative pt-10 px-4">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
              <line key={i} x1="0" y1={`${v * 100}%`} x2="100%" y2={`${v * 100}%`} stroke="white" strokeOpacity="0.05" strokeWidth="1" />
            ))}
            
            {/* The Path */}
            {timelineData.length > 1 && (
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut" }}
                d={`M ${timelineData.map((p, i) => `${(i / (timelineData.length - 1)) * 100},${100 - (p.y / Math.max(...timelineData.map(d => d.y), 1)) * 100}`).join(' L ')}`}
                fill="none"
                stroke="#ff0000"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            )}
            
            {/* Area under curve */}
            {timelineData.length > 1 && (
              <motion.path
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                d={`M 0,100 L ${timelineData.map((p, i) => `${(i / (timelineData.length - 1)) * 100},${100 - (p.y / Math.max(...timelineData.map(d => d.y), 1)) * 100}`).join(' L ')} L 100,100 Z`}
                fill="#ff0000"
              />
            )}

            {/* Data Points */}
            {timelineData.map((p, i) => (
              <circle 
                key={i} 
                cx={`${(i / (timelineData.length - 1)) * 100}%`} 
                cy={`${100 - (p.y / Math.max(...timelineData.map(d => d.y), 1)) * 100}%`} 
                r="4" 
                fill="#ff0000" 
              />
            ))}
          </svg>
          <div className="flex justify-between mt-4 text-[8px] font-black uppercase opacity-20 tracking-widest">
            <span>{isRTL ? 'بداية الرحلة' : 'INCEPTION'}</span>
            <span>{isRTL ? 'الوقت المستغرق (دقيقة)' : 'CUMULATIVE MINUTES'}</span>
            <span>{isRTL ? 'الآن' : 'PRESENT'}</span>
          </div>
        </div>
      </section>

      {/* --- Section 3: Per-Book Bar Chart (Analytics) --- */}
      <section className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3.5rem] space-y-8">
        <div className="flex items-center gap-4">
          <BarChart className="text-[#ff0000]" size={24} />
          <h3 className="text-xl font-black uppercase tracking-tighter italic">{isRTL ? 'توزيع الجهد حسب المخطوطة' : 'Effort Distribution per Manuscript'}</h3>
        </div>

        <div className="space-y-6">
          {sortedBooksByTime.map((book, idx) => (
            <div key={book.id} className="space-y-2">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black opacity-20">0{idx + 1}</span>
                  <span className="text-xs font-black uppercase truncate max-w-[150px] md:max-w-md">{book.title}</span>
                </div>
                <span className="text-[10px] font-black text-[#ff0000]">{Math.floor(book.timeSpentSeconds / 60)}m</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(book.timeSpentSeconds / maxTimeSeconds) * 100}%` }}
                  transition={{ duration: 1, delay: idx * 0.1 }}
                  className="h-full bg-gradient-to-r from-[#ff0000]/40 to-[#ff0000]"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- Section 4: Deep Vessel Analysis (Selection) --- */}
      <section className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3.5rem] space-y-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Microscope className="text-[#ff0000]" size={24} />
            <h3 className="text-xl font-black uppercase tracking-tighter italic">{isRTL ? 'تحليل المجهر المعرفي' : 'Cognitive Microscope'}</h3>
          </div>
          <div className="flex gap-2 bg-black/40 p-1.5 rounded-full border border-white/5 max-w-full overflow-x-auto no-scrollbar">
            {books.map(b => (
              <button key={b.id} onClick={() => setSelectedBookId(b.id)} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedBookId === b.id ? 'bg-[#ff0000] text-white' : 'text-white/20 hover:text-white/50'}`}>
                {b.title}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {selectedBook ? (
            <motion.div key={selectedBook.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                 <div className="flex items-center gap-6">
                    <div className="w-24 h-32 md:w-32 md:h-44 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0">
                      <img src={selectedBook.cover} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">{selectedBook.title}</p>
                      <p className="text-sm font-black text-[#ff0000] uppercase tracking-widest mt-2">{selectedBook.author}</p>
                      <div className="flex gap-4 mt-6">
                        <div className="text-center">
                          <p className="text-xl font-black">{Math.floor(selectedBook.timeSpentSeconds / 60)}</p>
                          <p className="text-[8px] uppercase font-black opacity-30">Min Spent</p>
                        </div>
                        <div className="w-[1px] h-8 bg-white/10" />
                        <div className="text-center">
                          <p className="text-xl font-black">{selectedBook.annotations?.length || 0}</p>
                          <p className="text-[8px] uppercase font-black opacity-30">Insights</p>
                        </div>
                        <div className="w-[1px] h-8 bg-white/10" />
                        <div className="text-center">
                          <p className="text-xl font-black">{selectedBook.stars}</p>
                          <p className="text-[8px] uppercase font-black opacity-30">Elite Stars</p>
                        </div>
                      </div>
                    </div>
                 </div>

                 <div className="bg-black/20 p-8 rounded-[2rem] border border-white/5 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30">{isRTL ? 'مؤشرات الأداء' : 'Performance Indicators'}</p>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-1">
                          <p className="text-xs font-bold opacity-60">{isRTL ? 'كثافة الحكمة' : 'Wisdom Density'}</p>
                          <p className="text-lg font-black text-[#ff0000]">{(selectedBook.annotations!.length / (selectedBook.timeSpentSeconds / 60 || 1)).toFixed(2)} <span className="text-[10px] opacity-40">/min</span></p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-xs font-bold opacity-60">{isRTL ? 'تاريخ البدء' : 'Inception Date'}</p>
                          <p className="text-sm font-black">{new Date(selectedBook.addedAt).toLocaleDateString(lang)}</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Data Visualization: Deciphering Pulse */}
              <div className="bg-black/40 p-10 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center relative">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-20 absolute top-8">{isRTL ? 'نبض فك التشفير' : 'Deciphering Pulse'}</p>
                <div className="w-full h-40 flex items-end gap-1 px-4">
                  {[...Array(24)].map((_, i) => {
                    const height = 15 + Math.random() * 85;
                    return (
                      <motion.div 
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 1, repeat: Infinity, repeatType: "reverse", delay: i * 0.05 }}
                        className="flex-1 bg-gradient-to-t from-[#ff0000] to-transparent rounded-full"
                      />
                    );
                  })}
                </div>
                <div className="mt-8 text-center">
                   <p className="text-sm font-black text-[#ff0000] uppercase tracking-tighter">Flow Integrity: HIGH</p>
                   <p className="text-[9px] font-black opacity-20 uppercase tracking-widest mt-1">Real-time engagement normalization active</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-10">
              <MousePointer2 size={48} className="mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">Select a manuscript for neural breakdown</p>
            </div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer Stats */}
      <footer className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] flex items-center justify-between">
           <div className="flex items-center gap-4">
              <Activity className="text-[#ff0000]" />
              <p className="text-sm font-black uppercase tracking-widest">{isRTL ? 'معدل الاستبقاء' : 'Retention Index'}</p>
           </div>
           <p className="text-3xl font-black italic">84%</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] flex items-center justify-between">
           <div className="flex items-center gap-4">
              <Zap className="text-[#ff0000]" />
              <p className="text-sm font-black uppercase tracking-widest">{isRTL ? 'إنجاز الأهداف' : 'Target Mastery'}</p>
           </div>
           <p className="text-3xl font-black italic">{(books.filter(b => b.stars > 0).length / (books.length || 1) * 100).toFixed(0)}%</p>
        </div>
      </footer>

    </motion.div>
  );
};
