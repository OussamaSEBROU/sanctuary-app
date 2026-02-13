
import React from 'react';
import { motion } from 'framer-motion';
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
  CalendarDays
} from 'lucide-react';

interface DashboardProps {
  books: Book[];
  shelves: ShelfData[];
  lang: Language;
  onBack: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ books, shelves, lang, onBack }) => {
  const t = translations[lang];
  const isRTL = lang === 'ar';

  // التحليلات المتقدمة
  const totalSeconds = books.reduce((acc, b) => acc + b.timeSpentSeconds, 0);
  const totalStars = books.reduce((acc, b) => acc + b.stars, 0);
  
  // توزيع الوقت حسب الرفوف
  const timePerShelf = shelves.map(s => {
    const shelfBooks = books.filter(b => b.shelfId === s.id);
    const time = shelfBooks.reduce((acc, b) => acc + b.timeSpentSeconds, 0);
    return { name: s.name, time, count: shelfBooks.length };
  }).sort((a, b) => b.time - a.time);

  // أفضل 5 كتب من حيث التركيز
  const topBooks = [...books].sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds).slice(0, 5);
  const maxTime = topBooks.length > 0 ? topBooks[0].timeSpentSeconds : 1;

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return isRTL ? `${h} س ${m} د` : `${h}h ${m}m`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-10 w-full max-w-7xl mx-auto space-y-10 mb-20"
    >
      <header className="flex items-center justify-between sticky top-0 bg-[#000a00]/80 backdrop-blur-xl py-6 z-50">
        <button onClick={onBack} className="p-3 bg-white/5 rounded-full hover:bg-[#ff0000]/20 text-white/60 hover:text-[#ff0000] transition-all flex items-center gap-2 group">
          <ChevronLeft className={`${isRTL ? "rotate-180" : ""} group-hover:scale-110 transition-transform`} />
          <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">{t.backToShelf}</span>
        </button>
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter flex items-center justify-center gap-4">
            <BrainCircuit className="text-[#ff0000] animate-pulse" size={36} />
            {t.dashboard}
          </h2>
          <p className="text-[9px] uppercase font-black tracking-[0.5em] text-[#ff0000]/40 mt-1">Advanced Cognitive Metrics</p>
        </div>
        <div className="hidden md:flex items-center gap-3 bg-white/5 px-6 py-2 rounded-full border border-white/10">
           <CalendarDays size={14} className="text-[#ff0000]" />
           <span className="text-[10px] font-black uppercase tracking-widest">{new Date().toLocaleDateString(lang)}</span>
        </div>
      </header>

      {/* بطاقات الإحصائيات الحيوية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: Clock, label: t.totalReadingTime, value: formatDuration(totalSeconds), color: "#ff0000" },
          { icon: Star, label: t.stars, value: totalStars, color: "#fbbf24" },
          { icon: Target, label: isRTL ? "معدل الإنجاز" : "Completion rate", value: `${books.length} كُتب`, color: "#22c55e" },
          { icon: Zap, label: isRTL ? "شدة التركيز" : "Focus Intensity", value: `${Math.floor(totalSeconds / 300)} pts`, color: "#3b82f6" },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -5 }}
            className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] flex flex-col items-start gap-4 relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-white/30 tracking-widest mb-1">{stat.label}</p>
              <p className="text-3xl font-black italic tracking-tighter">{stat.value}</p>
            </div>
            <div className="absolute -bottom-4 -right-4 opacity-5">
              <stat.icon size={100} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* تحليل الرفوف */}
        <section className="lg:col-span-2 bg-white/5 border border-white/10 p-10 rounded-[3.5rem] space-y-8 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <h3 className="text-xl font-black italic flex items-center gap-3 uppercase tracking-tighter">
              <PieChart className="text-[#ff0000]" /> {t.topCategories}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              {timePerShelf.map((shelf, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest">
                    <span className="opacity-40">{shelf.name}</span>
                    <span className="text-[#ff0000]">{Math.round((shelf.time / (totalSeconds || 1)) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(shelf.time / (totalSeconds || 1)) * 100}%` }}
                      className="h-full bg-[#ff0000] shadow-[0_0_15px_rgba(255,0,0,0.5)]"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center p-6 bg-white/[0.02] rounded-[3rem] border border-white/5">
               <div className="text-center">
                  <Activity size={48} className="text-[#ff0000] mx-auto mb-4 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 leading-relaxed">
                    {isRTL ? "يتم توزيع ذكاء القراءة بناءً على عمق الوقت المستثمر في كل رف" : "Reading intelligence is distributed based on focus depth"}
                  </p>
               </div>
            </div>
          </div>
        </section>

        {/* التدفق المعرفي */}
        <section className="bg-white/5 border border-white/10 p-10 rounded-[3.5rem] flex flex-col">
          <h3 className="text-xl font-black italic flex items-center gap-3 uppercase tracking-tighter mb-10">
            <TrendingUp className="text-[#ff0000]" /> {t.readingConsistency}
          </h3>
          <div className="flex-1 flex items-end justify-between h-48 gap-3 px-2">
            {topBooks.map((book, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-4 group cursor-help">
                <div className="w-full relative flex flex-col items-center justify-end h-full">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${(book.timeSpentSeconds / maxTime) * 100}%` }}
                    className="w-full max-w-[30px] bg-white hover:bg-[#ff0000] rounded-t-lg transition-colors relative"
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black px-2 py-1 rounded text-[8px] font-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {Math.floor(book.timeSpentSeconds / 60)}m
                    </div>
                  </motion.div>
                </div>
                <div className="text-[8px] font-black uppercase text-center opacity-30 group-hover:opacity-100 transition-opacity truncate w-full">
                  {book.title.split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* النشاط الأخير - نسخة احترافية */}
      <section className="bg-white/5 border border-white/10 p-10 rounded-[4rem] space-y-10">
        <h3 className="text-xl font-black italic flex items-center gap-3 uppercase tracking-tighter">
          <Activity className="text-[#ff0000]" /> {t.recentActivity}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {books.filter(b => b.lastReadAt).sort((a,b) => (b.lastReadAt || 0) - (a.lastReadAt || 0)).slice(0, 6).map((book, i) => (
            <div key={i} className="flex items-center justify-between p-6 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/10 hover:border-[#ff0000]/20 transition-all group">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-2xl">
                  <img src={book.cover} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight group-hover:text-[#ff0000] transition-colors">{book.title}</p>
                  <p className="text-[10px] font-black uppercase opacity-40 mt-1">{book.author}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black opacity-30 uppercase">{new Date(book.lastReadAt!).toLocaleDateString(lang, { month: 'short', day: 'numeric' })}</p>
                <div className="flex gap-1 mt-2 justify-end">
                   {[...Array(Math.min(book.stars, 5))].map((_, j) => <div key={j} className="w-1.5 h-1.5 rounded-full bg-[#ff0000]" />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
};
