
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
  Microscope
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

  // --- Aggregate Data Analysis ---
  const totalSeconds = useMemo(() => books.reduce((acc, b) => acc + b.timeSpentSeconds, 0), [books]);
  const totalStars = useMemo(() => books.reduce((acc, b) => acc + b.stars, 0), [books]);
  const totalAnnotations = useMemo(() => books.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [books]);
  
  // Cognitive Density: Annotations per hour
  const cognitiveDensity = totalSeconds > 0 ? (totalAnnotations / (totalSeconds / 3600)).toFixed(1) : 0;
  
  // Shelf Distribution
  const timePerShelf = useMemo(() => shelves.map(s => {
    const shelfBooks = books.filter(b => b.shelfId === s.id);
    const time = shelfBooks.reduce((acc, b) => acc + b.timeSpentSeconds, 0);
    return { name: s.name, time, count: shelfBooks.length };
  }).sort((a, b) => b.time - a.time), [books, shelves]);

  // Selected Book Analytics
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
          <p className="text-[9px] uppercase font-black tracking-[0.5em] text-[#ff0000]/40 mt-1">Global Intelligence Center</p>
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-6 py-2 rounded-full border border-white/10">
           <CalendarDays size={14} className="text-[#ff0000]" />
           <span className="text-[10px] font-black uppercase tracking-widest">{new Date().toLocaleDateString(lang)}</span>
        </div>
      </header>

      {/* --- Section 1: Fleet Intelligence (Aggregate) --- */}
      <section className="space-y-8">
        <div className="flex items-center gap-4 px-2">
          <TrendingUp className="text-[#ff0000]" size={20} />
          <h3 className="text-xl font-black uppercase tracking-tighter italic">Fleet Intelligence</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t.totalReadingTime, value: formatDuration(totalSeconds), icon: Clock, color: "#ff0000" },
            { label: 'Wisdom Extracted', value: totalAnnotations, icon: Microscope, color: "#3b82f6" },
            { label: 'Cognitive Density', value: `${cognitiveDensity}/h`, icon: Zap, color: "#fbbf24" },
            { label: 'Elite Stars', value: totalStars, icon: Star, color: "#ef4444" }
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

      {/* --- Section 2: Vessel Analysis (Individual Selection) --- */}
      <section className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3.5rem] space-y-10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Search className="text-[#ff0000]" size={24} />
            <h3 className="text-xl font-black uppercase tracking-tighter italic">Vessel Analysis</h3>
          </div>
          <div className="flex gap-2 bg-black/40 p-1.5 rounded-full border border-white/5 max-w-full overflow-x-auto no-scrollbar">
            {books.map(b => (
              <button 
                key={b.id} 
                onClick={() => setSelectedBookId(b.id)}
                className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedBookId === b.id ? 'bg-[#ff0000] text-white' : 'text-white/20 hover:text-white/50'}`}
              >
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
                      <div className="flex gap-1.5 mt-4">
                        <CheckCircle2 size={14} className="text-green-500" />
                        <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Manuscript Authenticated</span>
                      </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                      <p className="text-[9px] font-black uppercase opacity-30 tracking-widest mb-1">Focus Energy</p>
                      <p className="text-2xl font-black">{formatDuration(selectedBook.timeSpentSeconds)}</p>
                    </div>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                      <p className="text-[9px] font-black uppercase opacity-30 tracking-widest mb-1">Extraction Count</p>
                      <p className="text-2xl font-black">{selectedBook.annotations?.length || 0}</p>
                    </div>
                 </div>
              </div>

              {/* Individual Data Viz: Cognitive Footprint */}
              <div className="bg-black/40 p-10 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center relative">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-20 absolute top-8">Cognitive Footprint (Radar)</p>
                <div className="w-full aspect-square max-w-[280px] relative flex items-center justify-center">
                   {/* Dummy Radar Chart using SVGs */}
                   <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                      <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                      <path d="M50 5 L50 95 M5 50 L95 50 M18 18 L82 82 M18 82 L82 18" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                      {/* Active Footprint Path */}
                      <motion.path 
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.6 }}
                        d="M50 20 L80 50 L50 85 L20 40 Z" 
                        fill="rgba(255,0,0,0.3)" stroke="#ff0000" strokeWidth="2"
                      />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="text-[#ff0000] animate-pulse" size={24} />
                   </div>
                </div>
                <div className="flex gap-6 mt-6 opacity-40 text-[8px] font-black uppercase tracking-widest">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#ff0000]" /> Retention</div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Insight</div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-10">
              <MousePointer2 size={48} className="mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">Select a work for deep metrics</p>
            </div>
          )}
        </AnimatePresence>
      </section>

      {/* --- Section 3: Data Visualizations (Global Distribution) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-white/5 border border-white/10 p-10 rounded-[3.5rem] space-y-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-3">
              <PieChart className="text-[#ff0000]" /> Mastery Segments
            </h3>
          </div>
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
                  Focus distribution is calculated using cumulative deciphering time across all registered collections.
                </p>
             </div>
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 p-10 rounded-[3.5rem] flex flex-col justify-between">
           <div className="flex items-center gap-3">
              <Activity className="text-[#ff0000]" />
              <h3 className="text-xl font-black uppercase tracking-tighter italic">Fleet Status</h3>
           </div>
           <div className="space-y-8 mt-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase opacity-20 mb-1">Deciphering Active</p>
                  <p className="text-2xl font-black italic">{books.filter(b => b.timeSpentSeconds > 0).length}</p>
                </div>
                <Zap size={24} className="text-[#ff0000] opacity-40" />
              </div>
              <div className="h-[1px] bg-white/5" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase opacity-20 mb-1">Knowledge Density</p>
                  <p className="text-2xl font-black italic">{cognitiveDensity}</p>
                </div>
                <Microscope size={24} className="text-[#ff0000] opacity-40" />
              </div>
              <div className="h-[1px] bg-white/5" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase opacity-20 mb-1">Sanctuary Vault</p>
                  <p className="text-2xl font-black italic">{totalAnnotations}</p>
                </div>
                <FileText size={24} className="text-[#ff0000] opacity-40" />
              </div>
           </div>
        </section>
      </div>

    </motion.div>
  );
};
