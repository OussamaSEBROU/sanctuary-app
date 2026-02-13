
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Language } from '../types';
import { translations } from '../i18n/translations';
import { Star, Clock, Upload, ChevronLeft, ChevronRight } from 'lucide-react';

interface ShelfProps {
  books: Book[];
  lang: Language;
  onSelectBook: (book: Book) => void;
  onAddBook: () => void;
}

export const Shelf: React.FC<ShelfProps> = ({ books, lang, onSelectBook, onAddBook }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const t = translations[lang];

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-8">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full max-w-lg">
          <button onClick={onAddBook} className="group relative w-full aspect-[4/3] border-2 border-dashed border-white/5 rounded-[3rem] bg-white/5 hover:border-[#ff0000]/30 transition-all flex flex-col items-center justify-center gap-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff0000]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="p-6 rounded-full bg-white/5 border border-white/10 group-hover:scale-110 group-hover:bg-[#ff0000]/10 group-hover:border-[#ff0000]/30 transition-all">
               <Upload size={32} className="text-white/20 group-hover:text-[#ff0000]" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-black tracking-[0.3em] uppercase text-white/20 group-hover:text-[#ff0000]">{t.addToSanctuary}</span>
              <p className="text-[10px] text-white/10 group-hover:text-white/30 uppercase font-bold">{lang === 'ar' ? 'قم برفع ملف PDF للبدء' : 'Upload a PDF to begin'}</p>
            </div>
          </button>
        </motion.div>
      </div>
    );
  }

  const activeBook = books[activeIndex];
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="relative h-full flex flex-col items-center justify-start overflow-hidden w-full pt-10 px-4">
      {/* 3D Carousel Stage */}
      <div className="relative w-full h-[320px] md:h-[480px] flex items-center justify-center perspective-1000 mt-4 md:mt-8">
        <AnimatePresence mode="popLayout">
          {books.map((book, index) => {
            const isCenter = index === activeIndex;
            const diff = index - activeIndex;
            
            // Limit rendered items for performance and mobile space
            if (Math.abs(diff) > 2) return null;

            return (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ 
                  opacity: isCenter ? 1 : 0.25, 
                  x: diff * (window.innerWidth < 768 ? 120 : 280), 
                  scale: isCenter ? 1 : 0.7, 
                  rotateY: diff * (window.innerWidth < 768 ? -20 : -35),
                  zIndex: 20 - Math.abs(diff),
                  filter: isCenter ? 'blur(0px)' : 'blur(2px)'
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                onClick={() => isCenter ? onSelectBook(book) : setActiveIndex(index)}
                className="absolute w-[180px] h-[270px] md:w-[300px] md:h-[450px] cursor-pointer"
              >
                <div className={`relative w-full h-full rounded-[2.5rem] overflow-hidden border-2 transition-all duration-700
                   ${isCenter ? 'border-[#ff0000] shadow-[0_0_50px_rgba(255,0,0,0.3)]' : 'border-white/5 opacity-60'}`}>
                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-6 md:p-8">
                    <p className="text-sm md:text-2xl font-black truncate leading-tight uppercase tracking-tighter text-white">{book.title}</p>
                    <p className="text-[9px] md:text-xs text-[#ff0000] font-black uppercase tracking-widest mt-1">{book.author}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Book Metadata & Controls */}
      <motion.div 
        key={activeBook.id} 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mt-12 md:mt-16 text-center w-full px-6"
      >
        <div className="flex items-center justify-center gap-6 md:gap-12 mb-10 bg-white/5 border border-white/10 py-4 px-8 md:px-12 rounded-[2.5rem] inline-flex backdrop-blur-xl">
          <div className="flex flex-col items-center">
             <div className="flex gap-1 mb-1.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} className={i < activeBook.stars ? 'text-[#ff0000] fill-[#ff0000] drop-shadow-[0_0_5px_rgba(255,0,0,0.6)]' : 'text-white/5'} />
              ))}
            </div>
            <span className="text-[8px] md:text-[10px] uppercase font-black opacity-30 tracking-widest">{t.stars}</span>
          </div>
          <div className="h-10 w-[1px] bg-white/10" />
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2.5 text-sm md:text-xl font-black text-white">
              <Clock size={16} className="text-[#ff0000]" />
              {formatTime(activeBook.timeSpentSeconds)}
            </div>
            <span className="text-[8px] md:text-[10px] uppercase font-black opacity-30 tracking-widest">{t.cumulativeTime}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6">
           <button 
             onClick={() => setActiveIndex(prev => (prev - 1 + books.length) % books.length)} 
             className="p-4 rounded-full border border-white/10 text-white/30 hover:text-[#ff0000] hover:bg-[#ff0000]/10 hover:border-[#ff0000]/20 transition-all active:scale-90"
           >
             <ChevronLeft size={24}/>
           </button>
           
           <button 
             onClick={() => onSelectBook(activeBook)} 
             className="relative group bg-white px-14 py-4.5 rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
           >
              <div className="absolute inset-0 bg-[#ff0000] translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <span className="relative z-10 text-black group-hover:text-white font-black text-xs md:text-sm tracking-[0.4em] uppercase">
                {lang === 'ar' ? 'دخول' : 'Venture'}
              </span>
            </button>
            
            <button 
              onClick={() => setActiveIndex(prev => (prev + 1) % books.length)} 
              className="p-4 rounded-full border border-white/10 text-white/30 hover:text-[#ff0000] hover:bg-[#ff0000]/10 hover:border-[#ff0000]/20 transition-all active:scale-90"
            >
              <ChevronRight size={24}/>
            </button>
        </div>
      </motion.div>
    </div>
  );
};
