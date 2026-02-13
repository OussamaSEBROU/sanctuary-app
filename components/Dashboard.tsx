
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, ShelfData, Language } from '../types';
import { translations } from '../i18n/translations';
import { storageService } from '../services/storageService';
import { 
  Clock, Star, ChevronLeft, BrainCircuit, Sigma, Flame, BarChart, Trash2, AlertTriangle,
  TrendingUp, TrendingDown, Layers, Activity, Calendar, Zap
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

  // Shelf Comparisons
  const shelfStats = useMemo(() => {
    return shelves.map(shelf => {
      const shelfBooks = books.filter(b => b.shelfId === shelf.id);
      const time = shelfBooks.reduce((acc, b) => acc + b.timeSpentSeconds, 0);
      return { id: shelf.id, name: shelf.name, time, count: shelfBooks.length };
    }).sort((a, b) => b.time - a.time);
  }, [shelves, books]);

  const handleClearAll = () => {
    storageService.saveBooks([]);
    window.location.reload(); 
  };

  const handleDeleteShelf = (id: string) => {
    if (id === 'default') return;
    const updatedShelves = shelves.filter(s => s.id !== id);
    storageService.saveShelves(updatedShelves);
    // Move books to default
    const updatedBooks = books.map(b => b.shelfId === id ? { ...b, shelfId: 'default' } : b);
    storageService.saveBooks(updatedBooks);
    window.location.reload();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 w-full max-w-7xl mx-auto space-y-4 md:space-y-10 md:p-10 mb-24 bg-black/40 min-h-screen">
      
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 bg-black/95 backdrop-blur-2xl py-3 md:py-5 z-50 border-b border-white/5 px-2">
        <button onClick={onBack} className="self-start p-2.5 bg-white/5 rounded-full text-white/60 flex items-center gap-2 active:scale-95 transition-all">
          <ChevronLeft size={16} className={`${isRTL ? "rotate-180" : ""}`} />
          <span className="text-[8px] font-black uppercase tracking-widest">{t.backToShelf}</span>
        </button>
        <div className="text-center">
          <h2 className="text-xl md:text-5xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-4">
            <BrainCircuit className="text-[#ff0000] size-5 md:size-8 animate-pulse" />
            {t.dashboard}
          </h2>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => setShowClearConfirm(true)} className="p-2.5 bg-red-600/10 border border-red-600/20 rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all">
             <Trash2 size={16} />
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
            className="bg-white/5 border border-white/10 p-6 md:p-8 flex flex-col gap-3 rounded-[2.5rem] relative overflow-hidden group"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-[#ff0000]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             <stat.icon size={18} className="text-[#ff0000]" />
             <p className="text-[8px] uppercase font-black opacity-30 tracking-widest">{stat.label}</p>
             <p className="text-xl md:text-3xl font-black italic tracking-tighter relative z-10">{stat.value}</p>
          </motion.div>
        ))}
      </section>

      {/* Linear Knowledge Evolution Curve */}
      <section className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3rem] md:rounded-[4rem] space-y-10">
        <div className="flex items-center gap-4">
          <TrendingUp className="text-[#ff0000]" />
          <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter italic">{t.shelfEvolution}</h3>
        </div>
        <div className="h-[200px] flex items-end gap-1 px-4 relative">
          {knowledgeCurve.map((point, i) => (
            <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${(point.value / (knowledgeCurve[knowledgeCurve.length-1]?.value || 1)) * 100}%` }}
                className="w-full bg-[#ff0000]/20 hover:bg-[#ff0000] rounded-t-sm transition-all"
              />
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 bg-white text-black text-[8px] px-2 py-1 rounded font-black whitespace-nowrap z-20">
                {Math.floor(point.value / 60)}m
              </div>
            </div>
          ))}
          <div className="absolute inset-0 flex flex-col justify-between opacity-5 pointer-events-none">
             <div className="border-t border-white w-full" />
             <div className="border-t border-white w-full" />
             <div className="border-t border-white w-full" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Performance Periods */}
        <section className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3rem] space-y-8">
           <div className="flex items-center gap-4">
             <Zap className="text-[#ff0000]" />
             <h3 className="text-xl font-black uppercase tracking-tighter italic">{t.peakPerformance}</h3>
           </div>
           <div className="space-y-6">
              {performancePeriods.peak.map(([date, time], i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border-l-4 border-green-500">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="text-green-500" size={16} />
                    <span className="text-[10px] font-black uppercase opacity-60">{date}</span>
                  </div>
                  <span className="text-xs font-black">{Math.floor(time / 60)}m</span>
                </div>
              ))}
              {performancePeriods.low.map(([date, time], i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border-l-4 border-red-500/50">
                   <div className="flex items-center gap-3">
                    <TrendingDown className="text-red-500/50" size={16} />
                    <span className="text-[10px] font-black uppercase opacity-60">{date}</span>
                  </div>
                  <span className="text-xs font-black">{Math.floor(time / 60)}m</span>
                </div>
              ))}
           </div>
        </section>

        {/* Shelf Comparisons & Management */}
        <section className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3rem] space-y-8">
          <div className="flex items-center gap-4">
            <Layers className="text-[#ff0000]" />
            <h3 className="text-xl font-black uppercase tracking-tighter italic">{t.shelfComparison}</h3>
          </div>
          <div className="space-y-4">
            {shelfStats.map(shelf => (
              <div key={shelf.id} className="group flex flex-col gap-2 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#ff0000]" />
                    <span className="text-[10px] font-black uppercase truncate max-w-[150px]">{shelf.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-[#ff0000]">{Math.floor(shelf.time / 60)}m</span>
                    {shelf.id !== 'default' && (
                      <button 
                        onClick={() => setShelfToDelete(shelf.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-600 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(shelf.time / (shelfStats[0]?.time || 1)) * 100}%` }}
                    className="h-full bg-[#ff0000]"
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
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 rounded-[3rem] w-full max-w-sm shadow-2xl">
               <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6"><AlertTriangle size={32} /></div>
               <h3 className="text-xl font-black uppercase italic mb-4">{isRTL ? 'تأكيد المسح الشامل' : 'WIPE DATA'}</h3>
               <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-10 leading-relaxed">
                 {isRTL ? 'سيتم مسح جميع المخطوطات والتقدم والنجوم نهائياً. لا يمكن التراجع عن هذا الفعل.' : 'Permanent erasure of all records. This action is irreversible.'}
               </p>
               <div className="flex flex-col gap-3">
                 <button onClick={handleClearAll} className="w-full bg-red-600 py-4 rounded-2xl font-black text-[10px] uppercase text-white tracking-widest">{isRTL ? 'نعم، امسح كل شيء' : 'YES, WIPE EVERYTHING'}</button>
                 <button onClick={() => setShowClearConfirm(false)} className="w-full bg-white/5 py-4 rounded-2xl font-black text-[10px] uppercase text-white/30 tracking-widest">{isRTL ? 'إلغاء' : 'CANCEL'}</button>
               </div>
            </motion.div>
          </motion.div>
        )}

        {shelfToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 text-center">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 rounded-[3rem] w-full max-w-sm shadow-2xl">
               <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6"><Layers size={32} /></div>
               <h3 className="text-xl font-black uppercase italic mb-4">{t.deleteShelf}</h3>
               <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-10 leading-relaxed">
                 {t.confirmShelfDelete}
               </p>
               <div className="flex flex-col gap-3">
                 <button onClick={() => handleDeleteShelf(shelfToDelete)} className="w-full bg-red-600 py-4 rounded-2xl font-black text-[10px] uppercase text-white tracking-widest">{t.deleteShelf}</button>
                 <button onClick={() => setShelfToDelete(null)} className="w-full bg-white/5 py-4 rounded-2xl font-black text-[10px] uppercase text-white/30 tracking-widest">{t.discard}</button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
