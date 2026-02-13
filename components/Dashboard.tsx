
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, ShelfData, Language } from '../types';
import { translations } from '../i18n/translations';
import { 
  BarChart3, TrendingUp, Clock, Star, ChevronLeft,
  Activity, Zap, BrainCircuit, Sigma, Microscope, Flame, BarChart
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

  const totalSeconds = useMemo(() => books.reduce((acc, b) => acc + b.timeSpentSeconds, 0), [books]);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalAnnotations = useMemo(() => books.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [books]);
  const cognitiveDensity = totalSeconds > 0 ? (totalAnnotations / (totalSeconds / 3600)).toFixed(1) : 0;
  const sortedBooksByTime = useMemo(() => [...books].sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds), [books]);
  const maxTimeSeconds = Math.max(...books.map(b => b.timeSpentSeconds), 1);
  const selectedBook = useMemo(() => books.find(b => b.id === selectedBookId), [books, selectedBookId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 w-full max-w-7xl mx-auto space-y-4 md:space-y-10 md:p-10 mb-20 bg-black/40 min-h-screen">
      
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 bg-black/95 backdrop-blur-2xl py-3 md:py-4 z-50 border-b border-white/5 px-2">
        <button onClick={onBack} className="self-start p-2 bg-white/5 rounded-full text-white/60 flex items-center gap-2 group md:p-3">
          <ChevronLeft size={16} className={`${isRTL ? "rotate-180" : ""} md:size-[18px]`} />
          <span className="text-[8px] font-black uppercase tracking-widest md:text-[9px]">{t.backToShelf}</span>
        </button>
        <div className="text-center">
          <h2 className="text-lg md:text-5xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-2 md:gap-3">
            <BrainCircuit className="text-[#ff0000] size-5 md:size-6" />
            {isRTL ? 'مركز التحليل' : 'HUB'}
          </h2>
        </div>
        <div className="hidden md:flex items-center gap-3 bg-white/5 px-6 py-2 rounded-full border border-white/10">
           <Sigma size={14} className="text-[#ff0000]" />
           <span className="text-[10px] font-black uppercase tracking-widest">PRECISION: 100%</span>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {[
          { label: isRTL ? 'إجمالي الدقائق' : 'Total Mins', value: totalMinutes, icon: Clock },
          { label: isRTL ? 'كثافة الاستنباط' : 'Cognitive Density', value: cognitiveDensity, icon: Flame },
          { label: isRTL ? 'الحكمة' : 'Wisdom', value: totalAnnotations, icon: Sigma },
          { label: isRTL ? 'النجوم' : 'Stars', value: books.reduce((a,b)=>a+b.stars, 0), icon: Star }
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 border border-white/10 p-3 flex flex-col gap-1 rounded-[1.2rem] md:rounded-[2rem] md:p-8 md:gap-2">
             <stat.icon size={14} className="text-[#ff0000] md:size-[16px]" />
             <p className="text-[7px] uppercase font-black opacity-30 tracking-widest md:text-[8px]">{stat.label}</p>
             <p className="text-sm font-black italic tracking-tighter md:text-3xl">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="bg-white/5 border border-white/10 p-4 space-y-4 rounded-[1.5rem] md:rounded-[3.5rem] md:p-12 md:space-y-6">
        <div className="flex items-center gap-2 md:gap-3">
          <BarChart className="text-[#ff0000] size-4 md:size-5" />
          <h3 className="text-[10px] md:text-xl font-black uppercase tracking-tighter italic">{isRTL ? 'توزيع الجهد' : 'EFFORT'}</h3>
        </div>
        <div className="space-y-3 md:space-y-4">
          {sortedBooksByTime.slice(0, 5).map((book, idx) => (
            <div key={book.id} className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-black uppercase truncate max-w-[100px] md:text-[9px] md:max-w-[200px]">{book.title}</span>
                <span className="text-[8px] font-black text-[#ff0000] md:text-[9px]">{Math.floor(book.timeSpentSeconds / 60)}m</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden md:h-1.5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(book.timeSpentSeconds / maxTimeSeconds) * 100}%` }} className="h-full bg-[#ff0000]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white/5 border border-white/10 p-4 space-y-4 rounded-[1.5rem] md:rounded-[3.5rem] md:p-12 md:space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <Microscope className="text-[#ff0000] size-4 md:size-5" />
            <h3 className="text-[10px] md:text-xl font-black uppercase tracking-tighter italic">{isRTL ? 'تحليل المخطوطة' : 'ANALYSIS'}</h3>
          </div>
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
            {books.slice(0, 5).map(b => (
              <button key={b.id} onClick={() => setSelectedBookId(b.id)} className={`px-3 py-1 rounded-full text-[7px] font-black uppercase whitespace-nowrap transition-all md:px-4 md:py-1.5 md:text-[8px] ${selectedBookId === b.id ? 'bg-[#ff0000] text-white' : 'text-white/20 bg-white/5'}`}>
                {b.title}
              </button>
            ))}
          </div>
        </div>

        {selectedBook ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-row gap-4 items-center md:gap-6">
            <div className="w-12 h-16 rounded-lg overflow-hidden shadow-xl border border-white/10 shrink-0 md:w-32 md:h-44 md:rounded-xl">
              <img src={selectedBook.cover} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-black uppercase italic leading-tight md:text-3xl">{selectedBook.title}</p>
              <div className="flex gap-3 mt-2 md:mt-4 md:gap-4">
                 <div><p className="text-[10px] font-black md:text-sm">{Math.floor(selectedBook.timeSpentSeconds / 60)}</p><p className="text-[6px] uppercase font-black opacity-30 md:text-[7px]">MINS</p></div>
                 <div><p className="text-[10px] font-black md:text-sm">{selectedBook.annotations?.length || 0}</p><p className="text-[6px] uppercase font-black opacity-30 md:text-[7px]">NOTES</p></div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="py-4 text-center opacity-20 text-[8px] font-black uppercase tracking-widest">{isRTL ? 'اختر كتاباً للتحليل' : 'Select a work to analyze'}</div>
        )}
      </section>

      <footer className="grid grid-cols-2 gap-2 md:gap-3">
        <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between md:p-4 md:rounded-2xl">
           <Activity size={12} className="text-[#ff0000] md:size-3.5" />
           <p className="text-xs font-black italic md:text-lg">84%</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between md:p-4 md:rounded-2xl">
           <Zap size={12} className="text-[#ff0000] md:size-3.5" />
           <p className="text-xs font-black italic md:text-lg">{(books.filter(b=>b.stars>0).length/Math.max(books.length,1)*100).toFixed(0)}%</p>
        </div>
      </footer>
    </motion.div>
  );
};
