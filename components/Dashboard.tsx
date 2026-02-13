
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, ShelfData, Language } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { 
  Clock, Star, ChevronLeft, BrainCircuit, Sigma, Flame, BarChart, Trash2, AlertTriangle,
  TrendingUp, TrendingDown, Layers, Activity, Calendar, Zap, Award, BookOpen, BarChart3
} from 'lucide-react';

interface DashboardProps {
  books: Book[];
  shelves: ShelfData[];
  lang: Language;
  onBack: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ books, shelves, lang, onBack }) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [shelfToDelete, setShelfToDelete] = useState<string | null>(null);
  const t = translations[lang];
  const isRTL = lang === 'ar';

  const totalSeconds = useMemo(() => books.reduce((acc, b) => acc + b.timeSpentSeconds, 0), [books]);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalAnnotations = useMemo(() => books.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [books]);
  const cognitiveDensity = totalSeconds > 0 ? (totalAnnotations / (totalSeconds / 3600)).toFixed(1) : 0;

  // Linear knowledge expansion data (Cumulative time by date)
  const knowledgeCurve = useMemo(() => {
    const sorted = [...books].sort((a, b) => a.addedAt - b.addedAt);
    let cumulative = 0;
    return sorted.map(b => {
      cumulative += b.timeSpentSeconds;
      return { date: new Date(b.addedAt).toLocaleDateString(), value: cumulative };
    });
  }, [books]);

  // Shelf Comparisons (Vertical Curve Logic)
  const shelfStats = useMemo(() => {
    return shelves.map(shelf => {
      const shelfBooks = books.filter(b => b.shelfId === shelf.id);
      const time = shelfBooks.reduce((acc, b) => acc + b.timeSpentSeconds, 0);
      const minutes = Math.floor(time / 60);
      const averagePerBook = shelfBooks.length > 0 ? Math.floor(minutes / shelfBooks.length) : 0;
      return { id: shelf.id, name: shelf.name, minutes, count: shelfBooks.length, averagePerBook };
    }).sort((a, b) => b.minutes - a.minutes);
  }, [shelves, books]);

  // Book Mastery Ranking (Full Details)
  const bookRanking = useMemo(() => {
    return [...books]
      .sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)
      .slice(0, 10);
  }, [books]);

  // Performance periods (Max/Min)
  const performancePeriods = useMemo(() => {
    const map: Record<string, number> = {};
    books.forEach(b => {
      if (b.lastReadAt) {
        const d = new Date(b.lastReadAt).toDateString();
        map[d] = (map[d] || 0) + b.timeSpentSeconds;
      }
    });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return {
      peak: entries.slice(0, 3),
      low: entries.slice(-3).filter(e => e[1] > 0)
    };
  }, [books]);

  const handleClearAll = () => {
    storageService.saveBooks([]);
    window.location.reload(); 
  };

  const handleDeleteShelf = (id: string) => {
    if (id === 'default') return;
    const updatedShelves = shelves.filter(s => s.id !== id);
    storageService.saveShelves(updatedShelves);
    const updatedBooks = books.map(b => b.shelfId === id ? { ...b, shelfId: 'default' } : b);
    storageService.saveBooks(updatedBooks);
    window.location.reload();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 w-full max-w-7xl mx-auto space-y-6 md:space-y-12 md:p-10 mb-24 bg-black/40 min-h-screen">
      
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 bg-black/95 backdrop-blur-2xl py-4 md:py-6 z-50 border-b border-white/5 px-4 rounded-b-3xl">
        <button onClick={onBack} className="self-start p-3 bg-white/5 rounded-full text-white/60 flex items-center gap-2 active:scale-95 transition-all hover:bg-[#ff0000]/20 hover:text-white">
          <ChevronLeft size={20} className={`${isRTL ? "rotate-180" : ""}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.backToShelf}</span>
        </button>
        <div className="text-center">
          <h2 className="text-2xl md:text-5xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-4">
            <BrainCircuit className="text-[#ff0000] size-6 md:size-10 animate-pulse" />
            {t.dashboard}
          </h2>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => setShowClearConfirm(true)} className="p-3 bg-red-600/10 border border-red-600/20 rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all">
             <Trash2 size={20} />
           </button>
        </div>
      </header>

      {/* Primary Metrics Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t.cumulativeTime, value: `${totalMinutes}m`, icon: Clock },
          { label: t.cognitiveMetrics, value: cognitiveDensity, icon: Activity },
          { label: t.stars, value: books.reduce((a,b)=>a+b.stars, 0), icon: Star },
          { label: t.collections, value: shelves.length, icon: Layers }
        ].map((stat, i) => (
          <motion.div 
            key={i} 
            whileHover={{ y: -5 }}
            className="bg-white/5 border border-white/10 p-6 md:p-10 flex flex-col gap-4 rounded-[3rem] relative overflow-hidden group"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-[#ff0000]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <stat.icon size={22} className="text-[#ff0000]" />
             <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">{stat.label}</p>
             <p className="text-2xl md:text-4xl font-black italic tracking-tighter relative z-10">{stat.value}</p>
          </motion.div>
        ))}
      </section>

      {/* Vertical Comparison Stage: Shelves Against Others */}
      <section className="bg-white/5 border border-white/10 p-8 md:p-16 rounded-[4rem] space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <BarChart3 className="text-[#ff0000] size-8" />
            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">{t.shelfComparison}</h3>
          </div>
          <div className="flex items-center gap-8 text-[10px] font-black uppercase opacity-40">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff0000]" /> {t.totalReadingTime} (Min)</div>
          </div>
        </div>

        <div className="h-[350px] flex items-end justify-around gap-2 px-4 relative border-b border-white/5">
          {shelfStats.map((shelf, i) => {
            const maxMinutes = Math.max(...shelfStats.map(s => s.minutes), 1);
            const height = (shelf.minutes / maxMinutes) * 100;
            return (
              <div key={shelf.id} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  className="w-full max-w-[60px] bg-gradient-to-t from-[#ff0000] to-[#ff4d4d] rounded-t-2xl transition-all shadow-[0_-10px_30px_rgba(255,0,0,0.2)] group-hover:shadow-[0_-15px_40px_rgba(255,0,0,0.4)] relative"
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] px-3 py-1 rounded-full font-black opacity-0 group-hover:opacity-100 transition-all z-20 whitespace-nowrap">
                    {shelf.minutes}m
                  </div>
                </motion.div>
                <div className="mt-6 text-center">
                  <p className="text-[10px] font-black uppercase truncate w-24 opacity-60 group-hover:opacity-100 group-hover:text-[#ff0000] transition-colors">{shelf.name}</p>
                  <p className="text-[8px] font-black uppercase opacity-20">{shelf.count} {t.collections}</p>
                </div>
              </div>
            );
          })}
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between opacity-5 pointer-events-none pb-[60px]">
             {[...Array(5)].map((_, i) => <div key={i} className="border-t border-white w-full border-dashed" />)}
          </div>
        </div>
      </section>

      {/* Book Mastery Ranking (Detailed Breakdown in Minutes) */}
      <section className="bg-white/5 border border-white/10 p-8 md:p-16 rounded-[4rem] space-y-12">
        <div className="flex items-center gap-4">
          <Award className="text-[#ff0000] size-8" />
          <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic">{t.bookRanking}</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {bookRanking.map((book, idx) => (
            <motion.div 
              key={book.id}
              whileHover={{ x: 10 }}
              className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-[#ff0000]/20 transition-all group"
            >
              <div className="relative shrink-0">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center text-[10px] font-black text-[#ff0000] shadow-xl z-10">#{idx + 1}</div>
                <img src={book.cover} className="w-20 h-28 object-cover rounded-xl shadow-2xl group-hover:scale-105 transition-transform" />
              </div>
              <div className="flex-1 space-y-2">
                <h4 className="text-lg font-black uppercase italic tracking-tighter truncate w-full">{book.title}</h4>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#ff0000]/10 rounded-full border border-[#ff0000]/20">
                    <Clock size={12} className="text-[#ff0000]" />
                    <span className="text-[10px] font-black text-[#ff0000]">{Math.floor(book.timeSpentSeconds / 60)}m</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                    <Star size={12} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-[10px] font-black opacity-60">{book.stars}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-3">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (book.timeSpentSeconds / 3600) * 100)}%` }}
                    className="h-full bg-gradient-to-r from-[#ff0000] to-[#ff8000]"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Comparison Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
        {/* Performance Trends */}
        <section className="bg-white/5 border border-white/10 p-8 md:p-14 rounded-[4rem] space-y-10">
           <div className="flex items-center gap-4">
             <Zap className="text-[#ff0000] size-7" />
             <h3 className="text-xl font-black uppercase tracking-tighter italic">{t.peakPerformance}</h3>
           </div>
           <div className="space-y-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-30 mb-8">{isRTL ? 'تحليل فترات التركيز الأقصى والأدنى' : 'Max vs Min Focus Periods Analysis'}</p>
              {performancePeriods.peak.map(([date, time], i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border-l-4 border-green-500 shadow-xl">
                  <div className="flex items-center gap-4">
                    <TrendingUp className="text-green-500" size={18} />
                    <span className="text-[11px] font-black uppercase opacity-60">{date}</span>
                  </div>
                  <span className="text-sm font-black text-white">{Math.floor(time / 60)}m</span>
                </div>
              ))}
              <div className="py-4 border-b border-white/5" />
              {performancePeriods.low.map(([date, time], i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border-l-4 border-red-500/30 opacity-60">
                   <div className="flex items-center gap-4">
                    <TrendingDown className="text-red-500/30" size={18} />
                    <span className="text-[11px] font-black uppercase opacity-40">{date}</span>
                  </div>
                  <span className="text-sm font-black opacity-40">{Math.floor(time / 60)}m</span>
                </div>
              ))}
           </div>
        </section>

        {/* Efficiency Analytics */}
        <section className="bg-white/5 border border-white/10 p-8 md:p-14 rounded-[4rem] space-y-10">
          <div className="flex items-center gap-4">
            <Sigma className="text-[#ff0000] size-7" />
            <h3 className="text-xl font-black uppercase tracking-tighter italic">{t.shelfEfficiency}</h3>
          </div>
          <div className="space-y-4">
            {shelfStats.map(shelf => (
              <div key={shelf.id} className="group flex flex-col gap-4 p-6 bg-white/5 rounded-[2.5rem] hover:bg-white/10 transition-all border border-transparent hover:border-white/10 relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-[#ff0000] shadow-[0_0_10px_rgba(255,0,0,0.5)]" />
                    <span className="text-[11px] font-black uppercase truncate max-w-[180px]">{shelf.name}</span>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                       <p className="text-[10px] font-black text-[#ff0000]">{shelf.minutes}m Total</p>
                       <p className="text-[8px] font-black uppercase opacity-30">{shelf.averagePerBook} Min/Avg</p>
                    </div>
                    {shelf.id !== 'default' && (
                      <button 
                        onClick={() => setShelfToDelete(shelf.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-600 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden relative z-10">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(shelf.minutes / (shelfStats[0]?.minutes || 1)) * 100}%` }}
                    className="h-full bg-gradient-to-r from-[#ff0000] to-orange-500"
                   />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 text-center">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-12 rounded-[4rem] w-full max-w-sm shadow-2xl">
               <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 mx-auto mb-8"><AlertTriangle size={40} /></div>
               <h3 className="text-2xl font-black uppercase italic mb-6">{isRTL ? 'تأكيد المسح الشامل' : 'WIPE DATA'}</h3>
               <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-12 leading-relaxed">
                 {isRTL ? 'سيتم مسح جميع المخطوطات والتقدم والنجوم نهائياً. لا يمكن التراجع عن هذا الفعل.' : 'Permanent erasure of all records. This action is irreversible.'}
               </p>
               <div className="flex flex-col gap-4">
                 <button onClick={handleClearAll} className="w-full bg-red-600 py-5 rounded-[2rem] font-black text-xs uppercase text-white tracking-widest shadow-xl">{isRTL ? 'نعم، امسح كل شيء' : 'YES, WIPE EVERYTHING'}</button>
                 <button onClick={() => setShowClearConfirm(false)} className="w-full bg-white/5 py-5 rounded-[2rem] font-black text-xs uppercase text-white/30 tracking-widest">{isRTL ? 'إلغاء' : 'CANCEL'}</button>
               </div>
            </motion.div>
          </motion.div>
        )}

        {shelfToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 text-center">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-12 rounded-[4rem] w-full max-w-sm shadow-2xl">
               <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 mx-auto mb-8"><Layers size={40} /></div>
               <h3 className="text-2xl font-black uppercase italic mb-6">{t.deleteShelf}</h3>
               <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-12 leading-relaxed">
                 {t.confirmShelfDelete}
               </p>
               <div className="flex flex-col gap-4">
                 <button onClick={() => handleDeleteShelf(shelfToDelete)} className="w-full bg-red-600 py-5 rounded-[2rem] font-black text-xs uppercase text-white tracking-widest shadow-xl">{t.deleteShelf}</button>
                 <button onClick={() => setShelfToDelete(null)} className="w-full bg-white/5 py-5 rounded-[2rem] font-black text-xs uppercase text-white/30 tracking-widest">{t.discard}</button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
