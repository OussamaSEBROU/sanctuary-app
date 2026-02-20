
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book, Language } from '../types';
import { translations } from '../i18n/translations';
import { Upload } from 'lucide-react';

const MotionDiv = motion.div as any;

interface ShelfProps {
  books: Book[];
  lang: Language;
  activeIndex: number; // مدخل من الخارج
  onActiveIndexChange: (index: number) => void; // مخرج للخارج
  onSelectBook: (book: Book) => void;
  onAddBook: () => void;
}

export const Shelf: React.FC<ShelfProps> = ({ books, lang, activeIndex, onActiveIndexChange, onSelectBook, onAddBook }) => {
  const t = translations[lang];

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-8">
        <MotionDiv animate={{ opacity: 1, scale: 1 }} className="text-center w-full max-w-sm">
          <button onClick={onAddBook} className="group relative w-full aspect-[1/1.2] border-2 border-dashed border-white/10 rounded-[3rem] bg-white/[0.02] hover:border-[#ff0000]/40 transition-all flex flex-col items-center justify-center gap-8 overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff0000]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#ff0000]/10 group-hover:border-[#ff0000]/30 transition-all shrink-0">
               <Upload size={40} className="text-white/20 group-hover:text-[#ff0000]" />
            </div>
            <div className="flex flex-col items-center gap-3 px-6">
              <span className="text-[12px] font-black tracking-[0.4em] uppercase text-white/40 group-hover:text-[#ff0000] transition-colors">{t.addToSanctuary}</span>
              <p className="text-[10px] text-white/10 group-hover:text-white/30 uppercase font-bold text-center leading-relaxed">{lang === 'ar' ? 'قم برفع ملف PDF للبدء في بناء محرابك الخاص' : 'Upload a PDF to begin building your private sanctuary'}</p>
            </div>
          </button>
        </MotionDiv>
      </div>
    );
  }

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      onActiveIndexChange((activeIndex + 1) % books.length);
    } else if (info.offset.x > swipeThreshold) {
      onActiveIndexChange((activeIndex - 1 + books.length) % books.length);
    }
  };

  return (
    <div className="relative w-full flex-1 flex flex-col items-center justify-start overflow-visible pt-0 px-4">
      <MotionDiv 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        className="relative w-full h-[400px] md:h-[600px] flex items-center justify-center perspective-1000 -mt-16 md:-mt-24 touch-none cursor-grab active:cursor-grabbing"
      >
        <AnimatePresence mode="popLayout">
          {books.map((book, index) => {
            const isCenter = index === activeIndex;
            const diff = index - activeIndex;
            if (Math.abs(diff) > 2) return null;

            return (
              <MotionDiv
                key={book.id}
                initial={false}
                animate={{ 
                  opacity: isCenter ? 1 : 0.7, 
                  x: diff * (window.innerWidth < 768 ? 140 : 320), 
                  scale: isCenter ? 1.05 : 0.8, 
                  rotateY: diff * (window.innerWidth < 768 ? -10 : -20),
                  zIndex: 20 - Math.abs(diff),
                  filter: isCenter ? 'none' : 'brightness(0.8)' 
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                onClick={() => isCenter ? onSelectBook(book) : onActiveIndexChange(index)}
                className="absolute w-[220px] h-[310px] md:w-[380px] md:h-[540px]"
              >
                <div className={`relative w-full h-full rounded-[2.5rem] overflow-hidden border transition-all duration-700
                   ${isCenter ? 'border-[#ff0000]/50 shadow-[0_0_60px_rgba(255,0,0,0.4)]' : 'border-white/5 shadow-none'}`}>
                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover select-none pointer-events-none" />
                  
                  <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-6 md:p-12 pointer-events-none transition-opacity duration-500 ${isCenter ? 'opacity-100' : 'opacity-0'}`}>
                    <p className="text-lg md:text-3xl font-black truncate leading-tight uppercase tracking-tighter text-white drop-shadow-lg">{book.title}</p>
                    <p className="text-[10px] md:text-sm text-[#ff0000] font-black uppercase tracking-widest mt-1.5">{book.author}</p>
                  </div>
                  
                  {isCenter && (
                    <MotionDiv 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 hover:opacity-100 transition-opacity"
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
      <div className="mt-4 mb-8">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-10 animate-pulse">
           {lang === 'ar' ? 'اسحب للتنقل • انقر للدخول' : 'Swipe to Browse • Click to Enter'}
         </p>
      </div>
    </div>
  );
};

