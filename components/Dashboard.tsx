
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 w-full max-w-7xl mx-auto space-y-4 md:space-y-10 md:p-10 mb-24 bg-black/40 min-h-screen">
      
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 bg-black/95 backdrop-blur-2xl py-3 md:py-5 z-50 border-b border-white/5 px-2">
        <button onClick={onBack} className="self-start p-2.5 bg-white/5 rounded-full text-white/60 flex items-center gap-2 group active:scale-95">
          <ChevronLeft size={16} className={`${isRTL ? "rotate-180" : ""}`} />
          <span className="text-[8px] font-black uppercase tracking-widest">{t.backToShelf}</span>
        </button>
        <div className="text-center">
          <h2 className="text-xl md:text-5xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-2 md:gap-4">
            <BrainCircuit className="text-[#ff0000] size-5 md:size-8" />
            {isRTL ? 'مركز التحليل' : 'HUB'}
          </h2>
        </div>
        <div className="hidden md:flex items-center gap-3 bg-white/5 px-6 py-2 rounded-full border border-white/10">
           <Sigma size={14} className="text-[#ff0000]" />
           <span className="text-[10px] font-black uppercase tracking-widest">PRECISION: 100%</span>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
        {[
          { label: isRTL ? 'إجمالي الدقائق' : 'Total Mins', value: totalMinutes, icon: Clock },
          { label: isRTL ? 'كثافة الاستنباط' : 'Cognitive Density', value: cognitiveDensity, icon: Flame },
          { label: isRTL ? 'الحكمة' : 'Wisdom', value: totalAnnotations, icon: Sigma },
          { label: isRTL ? 'النجوم' : 'Stars', value: books.reduce((a,b)=>a+b.stars, 0), icon: Star }
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 border border-white/10 p-4 md:p-8 flex flex-col gap-1.5 md:gap-3 rounded-2xl md:rounded-[2.5rem]">
             <stat.icon size={14} className="text-[#ff0000] md:size-[18px]" />
             <p className="text-[7px] md:text-[8px] uppercase font-black opacity-30 tracking-widest">{stat.label}</p>
             <p className="text-sm md:text-3xl font-black italic tracking-tighter">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="bg-white/5 border border-white/10 p-5 md:p-12 space-y-5 rounded-[2rem] md:rounded-[4rem]">
        <div className="flex items-center gap-2.5">
          <BarChart className="text-[#ff0000] size-4 md:size-6" />
          <h3 className="text-xs md:text-2xl font-black uppercase tracking-tighter italic">{isRTL ? 'توزيع الجهد' : 'EFFORT'}</h3>
        </div>
        <div className="space-y-3 md:space-y-5">
          {sortedBooksByTime.slice(0, 5).map((book) => (
            <div key={book.id} className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] md:text-[10px] font-black uppercase truncate max-w-[120px] md:max-w-[250px]">{book.title}</span>
                <span className="text-[8px] md:text-[10px] font-black text-[#ff0000]">{Math.floor(book.timeSpentSeconds / 60)}m</span>
              </div>
              <div className="h-1.5 md:h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(book.timeSpentSeconds / maxTimeSeconds) * 100}%` }} className="h-full bg-[#ff0000]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white/5 border border-white/10 p-5 md:p-12 space-y-5 rounded-[2rem] md:rounded-[4rem]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Microscope className="text-[#ff0000] size-4 md:size-6" />
            <h3 className="text-xs md:text-2xl font-black uppercase tracking-tighter italic">{isRTL ? 'تحليل المخطوطة' : 'ANALYSIS'}</h3>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {books.slice(0, 5).map(b => (
              <button key={b.id} onClick={() => setSelectedBookId(b.id)} className={`px-3 py-1.5 rounded-full text-[7px] md:text-[9px] font-black uppercase whitespace-nowrap transition-all active:scale-95 ${selectedBookId === b.id ? 'bg-[#ff0000] text-white' : 'text-white/20 bg-white/5 hover:bg-white/10'}`}>
                {b.title}
              </button>
            ))}
          </div>
        </div>

        {selectedBook ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-row gap-4 md:gap-8 items-center pt-2">
            <div className="w-14 h-20 md:w-36 md:h-52 rounded-xl overflow-hidden shadow-2xl border border-white/10 shrink-0">
              <img src={selectedBook.cover} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-[11px] md:text-4xl font-black uppercase italic leading-tight truncate">{selectedBook.title}</p>
              <div className="flex gap-4 md:gap-6 mt-3">
                 <div><p className="text-xs md:text-xl font-black">{Math.floor(selectedBook.timeSpentSeconds / 60)}</p><p className="text-[6px] md:text-[8px] uppercase font-black opacity-30">MINS</p></div>
                 <div><p className="text-xs md:text-xl font-black">{selectedBook.annotations?.length || 0}</p><p className="text-[6px] md:text-[8px] uppercase font-black opacity-30">NOTES</p></div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="py-6 text-center opacity-20 text-[8px] md:text-[10px] font-black uppercase tracking-widest italic">{isRTL ? 'اختر كتاباً لمعاينة العمق' : 'Select work for deep analysis'}</div>
        )}
      </section>

      <footer className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 p-4 md:p-6 rounded-2xl md:rounded-3xl flex items-center justify-between">
           <Activity size={14} className="text-[#ff0000] md:size-[18px]" />
           <p className="text-sm md:text-xl font-black italic">84%</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-4 md:p-6 rounded-2xl md:rounded-3xl flex items-center justify-between">
           <Zap size={14} className="text-[#ff0000] md:size-[18px]" />
           <p className="text-sm md:text-xl font-black italic">{(books.filter(b=>b.stars>0).length/Math.max(books.length,1)*100).toFixed(0)}%</p>
        </div>
      </footer>
    </motion.div>
  );
};
