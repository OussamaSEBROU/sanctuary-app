
import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Book, Language } from '../types';
import { translations } from '../i18n/translations';
import { Star, Clock, Upload } from 'lucide-react';

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

  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      // Swipe Left -> Next
      setActiveIndex(prev => (prev + 1) % books.length);
    } else if (info.offset.x > swipeThreshold) {
      // Swipe Right -> Prev
      setActiveIndex(prev => (prev - 1 + books.length) % books.length);
    }
  };

  return (
    <div className="relative h-full flex flex-col items-center justify-start overflow-hidden w-full pt-4 md:pt-10 px-4">
      {/* 3D Carousel Stage with Drag Support */}
      <motion.div 
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
        className="relative w-full h-[350px] md:h-[550px] flex items-center justify-center perspective-1000 mt-2 md:mt-8 touch-none cursor-grab active:cursor-grabbing"
      >
        <AnimatePresence mode="popLayout">
          {books.map((book, index) => {
            const isCenter = index === activeIndex;
            const diff = index - activeIndex;
            
            // Limit rendered items for performance
            if (Math.abs(diff) > 2) return null;

            return (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ 
                  opacity: isCenter ? 1 : 0.3, 
                  x: diff * (window.innerWidth < 768 ? 140 : 300), 
                  scale: isCenter ? 1 : 0.75, 
                  rotateY: diff * (window.innerWidth < 768 ? -25 : -35),
                  zIndex: 20 - Math.abs(diff),
                  filter: isCenter ? 'blur(0px)' : 'blur(4px)'
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                onClick={() => isCenter ? onSelectBook(book) : setActiveIndex(index)}
                className="absolute w-[200px] h-[280px] md:w-[340px] md:h-[500px]"
              >
                <div className={`relative w-full h-full rounded-[2.5rem] overflow-hidden border-2 transition-all duration-50
