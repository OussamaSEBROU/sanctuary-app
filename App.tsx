
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ViewState, Book, Language, ShelfData } from './types';
import { Layout } from './components/Layout';
import { Shelf } from './components/Shelf';
import { Reader } from './components/Reader';
import { Dashboard } from './components/Dashboard';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { translations } from './i18n/translations';
import { storageService } from './services/storageService';
import { pdfStorage } from './services/pdfStorage';
import { 
  Plus, 
  Library, 
  X, 
  Menu, 
  Sparkles, 
  Trash2, 
  Loader2, 
  BookOpen, 
  Globe, 
  LayoutDashboard,
  Clock,
  Star,
  Upload,
  Zap,
  ShieldCheck,
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

declare const pdfjsLib: any;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const MotionDiv = motion.div as any;
const MotionAside = motion.aside as any;

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.SHELF);
  const [lang, setLang] = useState<Language>('ar');
  const [books, setBooks] = useState<Book[]>([]);
  const [shelves, setShelves] = useState<ShelfData[]>([]);
  const [activeShelfId, setActiveShelfId] = useState<string>('default');
  const [activeBookIndex, setActiveBookIndex] = useState(0); // رفع الحالة للتحكم في الإحصائيات العلوية
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newShelfName, setNewShelfName] = useState('');
  const [pendingFileData, setPendingFileData] = useState<ArrayBuffer | null>(null);
  const [celebrationStar, setCelebrationStar] = useState<number | null>(null);

  useEffect(() => {
    const loadedBooks = storageService.getBooks();
    const loadedShelves = storageService.getShelves();
    setBooks(loadedBooks);
    setShelves(loadedShelves);
  }, []);

  const t = translations[lang];
  const filteredBooks = books.filter(b => b.shelfId === activeShelfId);
  const fontClass = lang === 'ar' ? 'font-ar' : 'font-en';

  // حساب إحصائيات الكتاب النشط حالياً في العرض
  const activeBookStats = useMemo(() => {
    if (filteredBooks.length > 0 && filteredBooks[activeBookIndex]) {
      const book = filteredBooks[activeBookIndex];
      return {
        minutes: Math.floor(book.timeSpentSeconds / 60),
        stars: book.stars || 0
      };
    }
    return { minutes: 0, stars: 0 };
  }, [filteredBooks, activeBookIndex]);

  const totalTodayMinutes = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return Math.floor(books.reduce((acc, b) => {
      if (b.lastReadDate === today) return acc + (b.dailyTimeSeconds || 0);
      return acc;
    }, 0) / 60);
  }, [books]);

  const habitStreak = useMemo(() => storageService.getHabitData().streak, [books]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setIsExtracting(true);
      setNewBookTitle(file.name.replace(/\.[^/.]+$/, ""));
      try {
        const arrayBuffer = await file.arrayBuffer();
        setPendingFileData(arrayBuffer);
      } catch (err) {
        alert("Error loading PDF");
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const handleAddBook = async () => {
    if (!newBookTitle || !pendingFileData) return;
    const bookId = Math.random().toString(36).substr(2, 9);
    await pdfStorage.saveFile(bookId, pendingFileData);
    const newBook: Book = {
      id: bookId, shelfId: activeShelfId, title: newBookTitle,
      author: newBookAuthor || (lang === 'ar' ? 'مؤلف مجهول' : 'Unknown Scribe'),
      cover: `https://picsum.photos/seed/${newBookTitle}/800/1200`,
      content: "[VISUAL_PDF_MODE]", timeSpentSeconds: 0, dailyTimeSeconds: 0,
      lastReadDate: new Date().toISOString().split('T')[0], stars: 0,
      addedAt: Date.now(), lastPage: 0, annotations: []
    };
    const updated = [newBook, ...books];
    setBooks(updated);
    storageService.saveBooks(updated);
    setNewBookTitle(''); setNewBookAuthor(''); setPendingFileData(null); setIsAddingBook(false);
  };

  const handleAddShelf = () => {
    if (!newShelfName) return;
    const newShelf: ShelfData = { id: Math.random().toString(36).substr(2, 9), name: newShelfName, color: '#ff0000' };
    const updated = [...shelves, newShelf];
    setShelves(updated);
    storageService.saveShelves(updated);
    setNewShelfName(''); setIsAddingShelf(false);
  };

  const handleDeleteShelf = (e: React.MouseEvent, shelfId: string) => {
    e.stopPropagation();
    if (shelfId === 'default') return;
    const updatedShelves = shelves.filter(s => s.id !== shelfId);
    setShelves(updatedShelves);
    storageService.saveShelves(updatedShelves);
    const updatedBooks = books.map(b => b.shelfId === shelfId ? { ...b, shelfId: 'default' } : b);
    setBooks(updatedBooks);
    storageService.saveBooks(updatedBooks);
    if (activeShelfId === shelfId) setActiveShelfId('default');
  };

  const handleReaderBack = React.useCallback(() => {
    setBooks(storageService.getBooks());
    setView(ViewState.SHELF);
  }, []);

  const handleStatsUpdate = React.useCallback((starReached?: number | null) => {
    setBooks(storageService.getBooks());
    if (starReached) {
      setCelebrationStar(starReached);
    }
  }, []);

  const handleCelebrationComplete = React.useCallback(() => {
    setCelebrationStar(null);
  }, []);

  return (
    <Layout lang={lang}>
      <div className={`flex flex-col h-screen-safe overflow-hidden ${fontClass}`}>
        {/* Sidebar Navigation - Fixed z-index and functionality */}
        <AnimatePresence>
          {isSidebarOpen && (
            <React.Fragment key="sidebar-container">
              <MotionDiv 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setIsSidebarOpen(false)} 
                className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[4000] pointer-events-auto" 
              />
              <MotionAside
                initial={{ x: lang === 'ar' ? '100%' : '-100%' }} 
                animate={{ x: 0 }} 
                exit={{ x: lang === 'ar' ? '100%' : '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-[85vw] md:w-80 bg-[#050f05] border-none z-[4100] flex flex-col shadow-2xl overflow-hidden pointer-events-auto`}
              >
                <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5 shrink-0">
                   <div className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-[#ff0000] flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.3)]">
                      <Sparkles size={16} className="text-white" />
                    </div>
                    <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter text-white">{t.menu}</h2>
                   </div>
                   <button onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-full bg-white/5 text-white/40 hover:text-white transition-all"><X size={18}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 space-y-8 md:space-y-10">
                  <button onClick={() => { setView(ViewState.DASHBOARD); setIsSidebarOpen(false); }} className="w-full flex items-center gap-4 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] bg-[#ff0000]/10 border border-[#ff0000]/20 hover:bg-[#ff0000] hover:border-[#ff0000] transition-all group">
                    <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-white/10 group-hover:bg-white/20"><LayoutDashboard size={20} className="text-[#ff0000] group-hover:text-white" /></div>
                    <div className="flex flex-col items-start"><span className="text-[10px] md:text-xs font-black uppercase tracking-widest group-hover:text-white">{t.dashboard}</span><span className="text-[8px] md:text-[9px] uppercase font-black opacity-30 group-hover:opacity-60 group-hover:text-white">{t.cognitiveMetrics}</span></div>
                  </button>
                  
                  <section className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-3 opacity-20 px-2"><Globe size={12} className="text-white" /><span className="text-[9px] font-black uppercase tracking-widest text-white">{t.language}</span></div>
                    <div className="flex flex-col gap-2">
                      {['ar', 'en'].map((l) => (
                        <button key={l} onClick={() => { setLang(l as Language); setIsSidebarOpen(false); }} className={`w-full p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all flex items-center justify-between ${lang === l ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}>
                          <span className="text-xs md:text-sm font-bold uppercase">{l === 'ar' ? 'العربية' : 'English'}</span>
                          {lang === l && <div className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                        </button>
                      ))}
                    </div>
                  </section>
                  
                  <section className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-3 opacity-20 px-2"><BrainCircuit size={12} className="text-white" /><span className="text-[9px] font-black uppercase tracking-widest text-white">{lang === 'ar' ? 'طريقة عمل التطبيق' : 'How it Works'}</span></div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                      <p className="text-[9px] font-bold text-white/40 leading-relaxed uppercase">
                        {lang === 'ar' 
                          ? 'يعتمد التطبيق على مسار الـ 40 يوماً لبناء عادة القراءة العميقة، مقسمة لثلاث مراحل: المقاومة، التثبيت، والانصهار التام.' 
                          : 'The app uses a 40-day path to build deep reading habits, divided into three phases: Resistance, Installation, and Integration.'}
                      </p>
                    </div>
                  </section>

                  <section className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-3 opacity-20 px-2"><ShieldCheck size={12} className="text-white" /><span className="text-[9px] font-black uppercase tracking-widest text-white">{lang === 'ar' ? 'سياسة التطبيق' : 'App Policy'}</span></div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                      <ul className="space-y-2">
                        <li className="flex gap-2 text-[8px] font-black uppercase text-white/30">
                          <div className="w-1 h-1 rounded-full bg-blue-500 mt-1 shrink-0" />
                          <span>{lang === 'ar' ? 'جلسة الإنقاذ (2 دقيقة) تحمي السلسلة.' : 'Rescue Session (2 min) saves streak.'}</span>
                        </li>
                        <li className="flex gap-2 text-[8px] font-black uppercase text-white/30">
                          <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1 shrink-0" />
                          <span>{lang === 'ar' ? 'درع كل 7 أيام أو عند النجمة 5.' : 'Shield every 7 days or at 5th star.'}</span>
                        </li>
                        <li className="flex gap-2 text-[8px] font-black uppercase text-white/30">
                          <div className="w-1 h-1 rounded-full bg-red-600 mt-1 shrink-0" />
                          <span>{lang === 'ar' ? 'الحد الأقصى للدروع هو 3.' : 'Maximum shields allowed is 3.'}</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  <section className="space-y-3 md:space-y-4 pb-12">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3 opacity-20"><Library size={12} className="text-white" /><span className="text-[9px] font-black uppercase tracking-widest text-white">{t.collections}</span></div>
                      <button onClick={() => setIsAddingShelf(true)} className="p-1.5 bg-[#ff0000]/20 rounded-full text-[#ff0000] hover:scale-110 transition-transform"><Plus size={12}/></button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {shelves.map(shelf => (
                        <div key={shelf.id} onClick={() => { setActiveShelfId(shelf.id); setActiveBookIndex(0); setView(ViewState.SHELF); setIsSidebarOpen(false); }} className={`group w-full text-left px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl border transition-all text-[10px] md:text-xs font-bold flex items-center justify-between cursor-pointer ${activeShelfId === shelf.id ? 'bg-[#ff0000]/10 border-[#ff0000]/30 text-white' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5'}`}>
                          <div className="flex items-center gap-3 md:gap-4 truncate"><div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeShelfId === shelf.id ? 'bg-[#ff0000]' : 'bg-white/10'}`} /><span className="truncate">{shelf.name}</span></div>
                          {shelf.id !== 'default' && <button onClick={(e) => handleDeleteShelf(e, shelf.id)} className="p-2 text-white/0 group-hover:text-white/20 hover:text-red-600 transition-all rounded-lg hover:bg-white/5"><Trash2 size={12} /></button>}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </MotionAside>
            </React.Fragment>
          )}
        </AnimatePresence>

        {/* Global Fixed Controls - Elevated z-index to ensure visibility and clickability */}
        <div className="fixed top-0 left-0 right-0 z-[3000] p-4 md:p-8 pointer-events-none flex justify-between items-start">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-3.5 md:p-5 rounded-full bg-black/60 backdrop-blur-2xl border border-white/10 pointer-events-auto hover:bg-[#ff0000] hover:border-[#ff0000] transition-all shadow-2xl group active:scale-95 z-[3001]"
          >
            <Menu size={20} className="group-hover:text-white text-white/40 md:size-6"/>
          </button>
          
          {view === ViewState.SHELF && (
            <div className="flex flex-row items-center gap-3 pointer-events-auto">
              <MotionDiv initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 bg-black/60 backdrop-blur-xl px-4 py-2.5 md:px-6 md:py-3.5 rounded-full border border-[#ff0000]/30 shadow-xl">
                <Clock size={16} className="text-[#ff0000] animate-pulse" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[7px] font-black uppercase tracking-widest opacity-30 mb-0.5">{t.todayFocus}</span>
                  <span className="text-[11px] font-black text-[#ff0000]">{totalTodayMinutes} {lang === 'ar' ? 'دقيقة' : 'min'}</span>
                </div>
              </MotionDiv>
              
              {habitStreak > 0 && (
                <MotionDiv initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 bg-black/60 backdrop-blur-xl px-4 py-2.5 md:px-6 md:py-3.5 rounded-full border border-orange-500/30 shadow-xl">
                  <Zap size={16} className="text-orange-500" />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[7px] font-black uppercase tracking-widest opacity-30 mb-0.5">{lang === 'ar' ? 'الاستمرارية' : 'Streak'}</span>
                    <span className="text-[11px] font-black text-orange-500">{habitStreak} {lang === 'ar' ? 'يوم' : 'Days'}</span>
                  </div>
                </MotionDiv>
              )}

              <button onClick={() => setIsAddingBook(true)} className="px-5 md:px-8 py-3 md:py-4 rounded-full bg-white text-black text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-[#ff0000] hover:text-white transition-all flex items-center gap-2.5 active:scale-95">
                <Plus size={14} />{lang === 'ar' ? 'إضافة كتاب' : 'Add Work'}
              </button>
            </div>
          )}
        </div>

        {/* Main Content View Switcher */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {view === ViewState.SHELF && (
              <MotionDiv key="shelf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col relative">
                <header className="flex flex-col items-center text-center pt-20 md:pt-4 pb-2 md:pb-1 shrink-0 overflow-visible">
                  <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-black text-white uppercase big-title-white tracking-tighter px-4 leading-[1.0] text-center w-full max-w-full drop-shadow-2xl">{t.title}</h1>
                  <p className="shining-text text-[11px] md:text-xs font-bold mt-2 md:mt-1 px-8 md:px-12 max-w-2xl tracking-[0.4em] leading-relaxed opacity-90 italic">{t.philosophy}</p>
                  
                  {/* Book Specific Stats in Header - Linked to active index */}
                  <div className="mt-4 md:mt-2 flex items-center gap-4 md:gap-8 bg-black/40 backdrop-blur-3xl px-5 md:px-8 py-2 md:py-2 rounded-full border border-white/10 shadow-3xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />
                    <MotionDiv key={`min-${activeBookIndex}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center relative z-10">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-[#ff0000]" />
                        <span className="text-sm md:text-lg font-black text-white">{activeBookStats.minutes} {lang === 'ar' ? 'د' : 'm'}</span>
                      </div>
                      <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest opacity-20">{lang === 'ar' ? 'دقائق الكتاب' : 'Book Minutes'}</span>
                    </MotionDiv>
                    <div className="w-[1px] h-5 md:h-6 bg-white/10 relative z-10" />
                    <MotionDiv key={`star-${activeBookIndex}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center relative z-10">
                      <div className="flex items-center gap-2">
                        <Star size={12} className="text-[#ff0000] fill-[#ff0000]" />
                        <span className="text-sm md:text-lg font-black text-white">{activeBookStats.stars}</span>
                      </div>
                      <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest opacity-20">{t.stars}</span>
                    </MotionDiv>
                    {activeBookStats.stars > 0 && (
                      <>
                        <div className="w-[1px] h-5 md:h-6 bg-white/10 relative z-10" />
                        <MotionDiv initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center relative z-10">
                          <div className="flex items-center gap-2">
                            <Sparkles size={12} className="text-yellow-500" />
                            <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-tighter">{t.badges[activeBookStats.stars - 1]}</span>
                          </div>
                          <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest opacity-20">{lang === 'ar' ? 'الوسام الحالي' : 'Current Badge'}</span>
                        </MotionDiv>
                      </>
                    )}
                  </div>
                </header>
                
                <div className="flex-1 flex flex-col justify-center items-center">
                  <Shelf 
                    books={filteredBooks} 
                    lang={lang} 
                    activeIndex={activeBookIndex}
                    onActiveIndexChange={setActiveBookIndex}
                    onSelectBook={(b) => { setSelectedBook(b); setView(ViewState.READER); }} 
                    onAddBook={() => setIsAddingBook(true)} 
                  />
                </div>
                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none opacity-5">
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.6em] text-white">Developed By Oussama SEBROU</span>
                </div>
              </MotionDiv>
            )}
            {view === ViewState.DASHBOARD && (
              <MotionDiv key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto custom-scroll">
                <Dashboard books={books} shelves={shelves} lang={lang} onBack={() => setView(ViewState.SHELF)} />
              </MotionDiv>
            )}
            {view === ViewState.READER && selectedBook && (
              <MotionDiv key="reader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[5000]">
                <Reader 
                  book={selectedBook} 
                  lang={lang} 
                  onBack={handleReaderBack} 
                  onStatsUpdate={handleStatsUpdate} 
                />
              </MotionDiv>
            )}
          </AnimatePresence>
        </div>


        {/* Overlay Modals */}
        <AnimatePresence>
          {isAddingBook && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[6000] flex items-center justify-center p-0 md:p-6 bg-black/98 backdrop-blur-3xl">
              <MotionDiv initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} className="bg-[#0b140b] border border-white/5 p-8 md:p-12 rounded-none md:rounded-[4rem] w-full max-w-xl min-h-screen md:min-h-0 shadow-2xl relative flex flex-col justify-center">
                <button onClick={() => setIsAddingBook(false)} className="absolute top-6 right-6 md:top-10 md:right-10 p-2 rounded-full bg-white/5 text-white/20 hover:text-white transition-colors"><X size={20} className="md:size-6" /></button>
                <h2 className="text-xl md:text-3xl font-black mb-8 md:mb-12 text-white uppercase italic flex items-center gap-4 md:gap-5 leading-none"><BookOpen size={32} className="text-[#ff0000] md:size-11" /> {t.newIntake}</h2>
                <div className="space-y-6 md:space-y-8">
                  <div onClick={() => !isExtracting && fileInputRef.current?.click()} className="w-full aspect-video border-2 border-dashed border-white/10 rounded-[2rem] md:rounded-[3rem] flex flex-col items-center justify-center gap-4 md:gap-6 cursor-pointer hover:border-[#ff0000]/30 transition-all bg-white/5 group">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf" />
                    {isExtracting ? <div className="animate-spin text-[#ff0000]"><Loader2 size={32} className="md:size-10" /></div> : <><div className="p-4 md:p-6 bg-white/5 rounded-full group-hover:bg-[#ff0000] group-hover:text-white transition-all"><Upload size={24} className="text-white/20 md:size-10" /></div><span className="text-[9px] md:text-[11px] uppercase font-black opacity-30 tracking-[0.2em] md:tracking-[0.3em]">{pendingFileData ? newBookTitle : t.uploadHint}</span></>}
                  </div>
                  <div className="grid gap-3 md:gap-4">
                    <input type="text" value={newBookTitle} onChange={e => setNewBookTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 text-xs md:text-sm font-bold text-white outline-none focus:border-[#ff0000]/50" placeholder={t.bookTitle} />
                    <input type="text" value={newBookAuthor} onChange={e => setNewBookAuthor(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 text-xs md:text-sm font-bold text-white outline-none focus:border-[#ff0000]/50" placeholder={t.author} />
                  </div>
                  <button onClick={handleAddBook} disabled={!newBookTitle || !pendingFileData} className="w-full bg-white text-black py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] font-black text-[10px] md:text-xs uppercase shadow-2xl hover:bg-[#ff0000] hover:text-white transition-all tracking-[0.3em] md:tracking-[0.5em]">{t.save}</button>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}

          {isAddingShelf && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[6000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
              <MotionDiv initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 md:p-12 rounded-[2.5rem] md:rounded-[4rem] w-full max-w-md shadow-2xl text-center">
                <h3 className="text-2xl md:text-3xl font-black uppercase italic text-white mb-8 md:mb-10">{lang === 'ar' ? 'إنشاء رف' : 'New Shelf'}</h3>
                <input autoFocus type="text" value={newShelfName} onChange={e => setNewShelfName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 text-xs md:text-sm font-bold text-white outline-none mb-8 md:mb-10 focus:border-[#ff0000]/50" placeholder={lang === 'ar' ? 'اسم الرف...' : 'Shelf Name...'} />
                <button onClick={handleAddShelf} className="w-full bg-[#ff0000] py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] font-black text-[10px] md:text-xs uppercase shadow-2xl hover:scale-105 transition-transform text-white tracking-[0.3em] md:tracking-[0.4em]">{t.establish}</button>
              </MotionDiv>
            </MotionDiv>
          )}

          {celebrationStar && (
            <CelebrationOverlay 
              starCount={celebrationStar} 
              lang={lang} 
              onComplete={handleCelebrationComplete} 
            />
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default App;
