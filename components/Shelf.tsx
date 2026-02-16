
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Language } from '../types';
import { translations } from '../i18n/translations';
import { Star, Clock, Upload, Layers } from 'lucide-react';

// Using any to bypass motion property type errors
const MotionDiv = motion.div as any;

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
        <MotionDiv initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full max-w-lg">
          <button onClick={onAddBook} className="group relative w-full aspect-[4/3] border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/5 hover:border-[#ff0000]/30 transition-all flex flex-col items-center justify-center gap-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff0000]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="p-6 rounded-full bg-white/5 border border-white/10 group-hover:scale-110 group-hover:bg-[#ff0000]/10 group-hover:border-[#ff0000]/30 transition-all">
               <Upload size={32} className="text-white/20 group-hover:text-[#ff0000]" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-black tracking-[0.3em] uppercase text-white/20 group-hover:text-[#ff0000]">{t.addToSanctuary}</span>
              <p className="text-[10px] text-white/10 group-hover:text-white/30 uppercase font-bold">{lang === 'ar' ? 'قم برفع ملف PDF للبدء' : 'Upload a PDF to begin'}</p>
            </div>
          </button>
        </MotionDiv>
      </div>
    );
  }

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      setActiveIndex(prev => (prev + 1) % books.length);
    } else if (info.offset.x > swipeThreshold) {
      setActiveIndex(prev => (prev - 1 + books.length) % books.length);
    }
  };

  return (
    <div className="relative w-full flex-1 flex flex-col items-center justify-start overflow-visible pt-0 px-4">
      {/* 3D Carousel Stage - Raised Upward */}
      <MotionDiv 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        className="relative w-full h-[400px] md:h-[600px] flex items-center justify-center perspective-1000 -mt-10 md:-mt-16 touch-none cursor-grab active:cursor-grabbing"
      >
        <AnimatePresence mode="popLayout">
          {books.map((book, index) => {
            const isCenter = index === activeIndex;
            const diff = index - activeIndex;
            
            if (Math.abs(diff) > 2) return null;

            return (
              <MotionDiv
                key={book.id}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ 
                  opacity: isCenter ? 1 : 0.5, 
                  x: diff * (window.innerWidth < 768 ? 160 : 340), 
                  scale: isCenter ? 1.05 : 0.8, 
                  rotateY: diff * (window.innerWidth < 768 ? -20 : -30),
                  zIndex: 20 - Math.abs(diff),
                  filter: 'blur(0px)' // Removed all blur for maximum clarity
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                onClick={() => isCenter ? onSelectBook(book) : setActiveIndex(index)}
                className="absolute w-[220px] h-[310px] md:w-[380px] md:h-[540px]"
              >
                <div className={`relative w-full h-full rounded-[2.5rem] overflow-hidden border transition-all duration-500
                   ${isCenter ? 'border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.8)]' : 'border-white/5'}`}>
                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover select-none pointer-events-none" />
                  
                  {/* Title Overlay for clarity */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-6 md:p-12 pointer-events-none">
                    <p className="text-lg md:text-3xl font-black truncate leading-tight uppercase tracking-tighter text-white drop-shadow-lg">{book.title}</p>
                    <p className="text-[10px] md:text-sm text-[#ff0000] font-black uppercase tracking-widest mt-1.5">{book.author}</p>
                  </div>
                  
                  {isCenter && (
                    <MotionDiv 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <div className="bg-white text-black px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl">
                        {lang === 'ar' ? 'دخول' : 'Enter'}
                      </div>
                    </MotionDiv>
                  )}
                </div>
              </MotionDiv>
            );
          })}
        </AnimatePresence>
      </MotionDiv>

      {/* Navigation Hint */}
      <div className="mt-8 mb-12">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-10 animate-pulse">
           {lang === 'ar' ? 'اسحب للتنقل • انقر للدخول' : 'Swipe to Browse • Click to Enter'}
         </p>
      </div>
    </div>
  );
};
