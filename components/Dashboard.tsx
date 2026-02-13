
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
  Flame
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
  const totalStars = useMemo(() => books.reduce((acc, b) => acc + b.stars, 0), [books]);
  const totalAnnotations = useMemo(() => books.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [books]);
  
  const cognitiveDensity = totalSeconds > 0 ? (totalAnnotations / (totalSeconds / 3600)).toFixed(1) : 0;
  
  const timePerShelf = useMemo(() => shelves.map(s => {
    const shelfBooks = books.filter(b => b.shelfId === s.id);
    const time = shelfBooks.reduce((acc, b) => acc + b.timeSpentSeconds, 0);
    return { name: s.name, time, count: shelfBooks.length };
  }).sort((a, b) => b.time - a.time), [books, shelves]);

  const selectedBook = useMemo(() => books.find(b => b.id === selectedBookId), [books, selectedBookId]);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return isRTL ? `${h} س ${m} د` : `${h}h ${m}m`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-10 w-full max-w-7xl mx-auto space-y-10 mb-20 bg-black/40 min-h-screen">
      <header className="flex flex-col md:flex-row items-center justify-between gap-6 sticky top-0 bg-black/90 backdrop-blur-2xl py-6 z-50 border-b border-white/5">
        <button onClick={onBack} className="p-3 bg-white/5 rounded-full hover:bg-[#ff0000]/20 text-white/60 hover:text-[#ff0000] transition-all flex items-center gap-2 group">
          <ChevronLeft className={`${isRTL ? "rotate-180" : ""} group-hover:scale-110`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.backToShelf}</span>
        </button>
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-4">
            <BrainCircuit className="text-[#ff0000]" size={36} />
            {t.dashboard}
          </h2>
          <p className="text-[9px] uppercase font-black tracking-[0.5em] text-[#ff0000]/40 mt-1">Intelligence Core Activated</p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-6 py-2 rounded-full border border-white/10">
           <Flame size={14} className="text-[#ff0000] animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-widest">Cognitive Sync: Active</span>
        </div>
      </header>

      <section className="space-y-8">
        <div className="flex items-center gap-4 px-2">
          <TrendingUp className="text-[#ff0000]" size={20} />
          <h3 className="text-xl font-black uppercase tracking-tighter italic">Fleet Intelligence</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t.totalReadingTime, value: formatDuration(totalSeconds), icon: Clock, color: "#ff0000" },
            { label: 'Wisdom Extracted', value: totalAnnotations, icon: Microscope, color: "#3b82f6" },
            { label: 'Flow Potential', value: `${(totalStars * 1.2).toFixed(1)}%`, icon: Zap, color: "#fbbf24" },
            { label: 'Cognitive Density', value: `${cognitiveDensity}/h`, icon: Flame, color: "#ef4444" }
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
        </div>
      </section>

      <section className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3.5rem] space-y-10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Search className="text-[#ff0000]" size={24} />
            <h3 className="text-xl font-black uppercase tracking-tighter italic">Vessel Analysis</h3>
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
            <motion.div key={selectedBook.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                 <div className="flex items-center gap-6">
                    <div className="w-24 h-32 md:w-32 md:h-44 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0">
                      <img src={selectedBook.cover} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter leading-none">{selectedBook.title}</p>
                      <p className="text-sm font-black text-[#ff0000] uppercase tracking-widest mt-2">{selectedBook.author}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                      <p className="text-[9px] font-black uppercase opacity-30 tracking-widest mb-1">Deep Work Energy</p>
                      <p className="text-2xl font-black">{formatDuration(selectedBook.timeSpentSeconds)}</p>
                    </div>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                      <p className="text-[9px] font-black uppercase opacity-30 tracking-widest mb-1">Wisdom Fragments</p>
                      <p className="text-2xl font-black">{selectedBook.annotations?.length || 0}</p>
                    </div>
                 </div>
              </div>

              <div className="bg-black/40 p-10 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center relative">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-20 absolute top-8">Deciphering Pulse (Real-time)</p>
                <div className="w-full h-40 flex items-end gap-1 px-4">
                  {[...Array(20)].map((_, i) => {
                    const height = 20 + Math.random() * 80;
                    return (
                      <motion.div 
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", delay: i * 0.1 }}
                        className="flex-1 bg-gradient-to-t from-[#ff0000] to-[#ff0000]/20 rounded-full"
                      />
                    );
                  })}
                </div>
                <div className="mt-8 text-center">
                   <p className="text-sm font-black text-[#ff0000] uppercase tracking-tighter">Flow State: Optimal</p>
                   <p className="text-[9px] font-black opacity-20 uppercase tracking-widest mt-1">Neurological Alignment 94%</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-10">
              <MousePointer2 size={48} className="mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">Select a work for neural analysis</p>
            </div>
          )}
        </AnimatePresence>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-white/5 border border-white/10 p-10 rounded-[3.5rem] space-y-10">
          <h3 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <PieChart className="text-[#ff0000]" /> Intelligence Map
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
             <div className="space-y-6">
                {timePerShelf.map((s, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                      <span className="opacity-40">{s.name}</span>
                      <span className="text-[#ff0000]">{Math.round((s.time / (totalSeconds || 1)) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                       <motion.div initial={{ width: 0 }} animate={{ width: `${(s.time / (totalSeconds || 1)) * 100}%` }} className="h-full bg-[#ff0000]" />
                    </div>
                  </div>
                ))}
             </div>
             <div className="flex flex-col items-center justify-center bg-black/40 rounded-[3rem] p-10 border border-white/5 text-center">
                <BarChart3 className="text-[#ff0000] opacity-20 mb-6" size={48} />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-30 leading-relaxed">
                  Focus patterns analyzed through the lens of continuous deciphering sessions.
                </p>
             </div>
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 p-10 rounded-[3.5rem] flex flex-col justify-between">
           <div className="flex items-center gap-3">
              <Activity className="text-[#ff0000]" />
              <h3 className="text-xl font-black uppercase tracking-tighter italic">Neural Status</h3>
           </div>
           <div className="space-y-8 mt-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase opacity-20 mb-1">Focus Frequency</p>
                  <p className="text-2xl font-black italic">{(totalSeconds / (books.length || 1) / 60).toFixed(0)}m</p>
                </div>
                <Zap size={24} className="text-[#ff0000] opacity-40" />
              </div>
              <div className="h-[1px] bg-white/5" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase opacity-20 mb-1">Retention Rate</p>
                  <p className="text-2xl font-black italic">88.4%</p>
                </div>
                <Target size={24} className="text-[#ff0000] opacity-40" />
              </div>
           </div>
        </section>
      </div>

    </motion.div>
  );
};
