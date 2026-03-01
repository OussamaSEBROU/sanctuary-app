
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ViewState, Language, Insight, CollectiveSession } from './types';
import type { Book, ShelfData } from './types';
import { Layout } from './components/Layout';
import { Shelf } from './components/Shelf';
import { Reader } from './components/Reader';
import { Dashboard } from './components/Dashboard';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { Onboarding } from './components/Onboarding';
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
  BrainCircuit,
  Mail,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';

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
  const [activeBookIndex, setActiveBookIndex] = useState(0);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [collectiveSessions, setCollectiveSessions] = useState<CollectiveSession[]>(storageService.getCollectiveSessions());
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
  const [activeInsightIndex, setActiveInsightIndex] = useState(0);
  const [showInsights, setShowInsights] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Collective Session State
  const [isAddingMenuOpen, setIsAddingMenuOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isCollectiveMode, setIsCollectiveMode] = useState(false);
  const [roomData, setRoomData] = useState<any>(null);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [isCollectivePending, setIsCollectivePending] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [userId] = useState(() => {
    const saved = localStorage.getItem('sanctuary_user_id');
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('sanctuary_user_id', newId);
    return newId;
  });

  useEffect(() => {
    const onboardingSeen = localStorage.getItem('sanctuary_onboarding_seen');
    const actualBooks = storageService.getBooks();
    
    setBooks(prev => {
      if (prev.length > 0) return prev;
      return actualBooks;
    });
    
    setShelves(storageService.getShelves());
    
    if (!onboardingSeen && actualBooks.length === 0) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    const newSocket = io(window.location.origin, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    
    setSocket(newSocket);

    newSocket.on("connect", () => {
      const urlParams = new URLSearchParams(window.location.search);
      const roomToJoin = urlParams.get('room') || localStorage.getItem('sanctuary_room_id');
      
      if (roomToJoin) {
        newSocket.emit("join-room", { 
          roomId: roomToJoin, 
          userId,
          name: lang === 'ar' ? 'قارئ منضم' : 'Joined Reader' 
        });
        setRoomId(roomToJoin);
        setIsCollectiveMode(true);
        setIsJoiningRoom(false);
        if (urlParams.get('room')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    });

    newSocket.on("room-created", (id) => {
      setRoomId(id);
      localStorage.setItem('sanctuary_room_id', id);
      setIsCollectiveMode(true);
      setIsAddingMenuOpen(false);
    });

    const handleRoomData = (data: any) => {
      setRoomData(data);
      if (data.bookData) {
        setBooks(prevBooks => {
          const bookExists = prevBooks.some(b => b.id === data.bookData.id);
          if (!bookExists) {
            const sessionBook = { ...data.bookData, isCollectiveOnly: true };
            const updatedBooks = [sessionBook, ...prevBooks];
            storageService.saveBooks(updatedBooks);
            return updatedBooks;
          }
          return prevBooks;
        });
        
        setSelectedBook(data.bookData);
        setView(ViewState.READER);
        setIsCollectiveMode(true);
      }
    };

    newSocket.on("room-joined", handleRoomData);
    newSocket.on("room-updated", handleRoomData);

    newSocket.on("book-selected", ({ bookId, bookData }) => {
      if (bookData) {
        setBooks(prevBooks => {
          const bookExists = prevBooks.some(b => b.id === bookData.id);
          if (!bookExists) {
            const sessionBook = { ...bookData, isCollectiveOnly: true };
            const updatedBooks = [sessionBook, ...prevBooks];
            storageService.saveBooks(updatedBooks);
            return updatedBooks;
          }
          return prevBooks;
        });
        
        setSelectedBook(bookData);
        setView(ViewState.READER);
        setIsCollectiveMode(true);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [userId]);

  const handleCreateRoom = (book?: Book) => {
    if (socket) {
      socket.emit("create-room", { 
        adminId: userId,
        adminName: lang === 'ar' ? 'أدمن المحراب' : 'Sanctuary Admin',
        roomName: sessionName || (lang === 'ar' ? 'جلسة قرائية' : 'Reading Session'),
        bookId: book?.id,
        bookData: book
      });
    }
  };

  const handleJoinRoom = () => {
    if (socket && joinRoomInput) {
      socket.emit("join-room", { 
        roomId: joinRoomInput, 
        userId,
        name: lang === 'ar' ? 'قارئ منضم' : 'Joined Reader' 
      });
      setRoomId(joinRoomInput);
      localStorage.setItem('sanctuary_room_id', joinRoomInput);
      setIsCollectiveMode(true);
      setIsJoiningRoom(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('sanctuary_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  const confirmDeleteBook = async () => {
    if (!bookToDelete || (deleteConfirmInput !== 'امسح من المحراب' && deleteConfirmInput !== 'DELETE FROM SANCTUARY')) return;
    await pdfStorage.deleteFile(bookToDelete.id);
    storageService.deleteBook(bookToDelete.id);
    const updatedBooks = storageService.getBooks();
    setBooks(updatedBooks);
    setBookToDelete(null);
    setDeleteConfirmInput('');
    if (activeBookIndex >= updatedBooks.filter(b => b.shelfId === activeShelfId).length) {
      setActiveBookIndex(Math.max(0, updatedBooks.filter(b => b.shelfId === activeShelfId).length - 1));
    }
  };

  const handleReaderBack = React.useCallback(() => {
    setBooks(storageService.getBooks());
    setView(ViewState.SHELF);
  }, []);

  const handleStatsUpdate = React.useCallback((starReached?: number | null) => {
    setBooks(storageService.getBooks());
    setCollectiveSessions(storageService.getCollectiveSessions());
    if (starReached) setCelebrationStar(starReached);
  }, []);

  const handleCelebrationComplete = React.useCallback(() => {
    setCelebrationStar(null);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      setPendingFileData(arrayBuffer);
      setNewBookTitle(file.name.replace('.pdf', ''));
    } catch (err) {
      console.error(err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddBook = async () => {
    if (!pendingFileData || !newBookTitle) return;
    const newBook: Book = {
      id: Math.random().toString(36).substring(2, 15),
      title: newBookTitle,
      author: newBookAuthor || (lang === 'ar' ? 'غير معروف' : 'Unknown'),
      shelfId: activeShelfId,
      addedAt: Date.now(),
      lastPage: 0,
      totalPages: 0,
      annotations: []
    };
    await pdfStorage.saveFile(newBook.id, pendingFileData);
    storageService.addBook(newBook);
    setBooks(storageService.getBooks());
    setIsAddingBook(false);
    setPendingFileData(null);
    setNewBookTitle('');
    setNewBookAuthor('');
    if (isCollectivePending) {
      handleCreateRoom(newBook);
      setIsCollectivePending(false);
    }
  };

  const handleAddShelf = () => {
    if (!newShelfName) return;
    const newShelf: ShelfData = { id: Math.random().toString(36).substring(2, 15), name: newShelfName };
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

  useEffect(() => {
    if (view === ViewState.SHELF) {
      setShowInsights(true);
      const timer = setTimeout(() => setShowInsights(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  const t = translations[lang];
  const fontClass = lang === 'ar' ? 'font-ar' : 'font-en';
  const filteredBooks = books.filter(b => b.shelfId === activeShelfId);
  const activeBook = filteredBooks[activeBookIndex];
  const activeBookStats = activeBook ? storageService.getBookStats(activeBook.id) : { minutes: 0, stars: 0 };

  const insights: Insight[] = useMemo(() => [
    { text: lang === 'ar' ? 'أنت تقرأ بانتظام مذهل!' : 'You read with amazing regularity!', icon: <Sparkles className="text-yellow-400" size={18} />, color: 'bg-yellow-400/10 border-yellow-400/20', isShining: true },
    { text: lang === 'ar' ? 'لقد وصلت لـ 5 نجوم في كتاب واحد' : 'You reached 5 stars in one book', icon: <Star className="text-emerald-400" size={18} />, color: 'bg-emerald-400/10 border-emerald-400/20' },
    { text: lang === 'ar' ? 'وقتك المفضل للقراءة هو المساء' : 'Your favorite reading time is evening', icon: <Clock className="text-blue-400" size={18} />, color: 'bg-blue-400/10 border-blue-400/20' }
  ], [lang]);

  return (
    <Layout lang={lang}>
      <div className={`flex flex-col h-screen-safe overflow-y-auto custom-scroll ${fontClass}`}>
        <AnimatePresence>
          {isSidebarOpen && (
            <MotionAside initial={{ x: lang === 'ar' ? 300 : -300 }} animate={{ x: 0 }} exit={{ x: lang === 'ar' ? 300 : -300 }} className={`fixed inset-y-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-72 bg-[#0b140b] border-${lang === 'ar' ? 'l' : 'r'} border-white/5 z-[8000] p-8 flex flex-col shadow-2xl`}>
              <div className="flex items-center justify-between mb-12">
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">{t.library}</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-full bg-white/5 text-white/40 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto custom-scroll pr-2">
                <button onClick={() => { setActiveShelfId('default'); setActiveBookIndex(0); setView(ViewState.SHELF); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${activeShelfId === 'default' ? 'bg-white text-black' : 'text-white/40 hover:bg-white/5'}`}>
                  <div className="flex items-center gap-3"><Library size={18} /> <span className="text-xs font-black uppercase tracking-widest">{t.defaultShelf}</span></div>
                  <span className="text-[10px] font-black opacity-40">{books.filter(b => b.shelfId === 'default').length}</span>
                </button>
                {shelves.map(shelf => (
                  <div key={shelf.id} className="group relative">
                    <button onClick={() => { setActiveShelfId(shelf.id); setActiveBookIndex(0); setView(ViewState.SHELF); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${activeShelfId === shelf.id ? 'bg-white text-black' : 'text-white/40 hover:bg-white/5'}`}>
                      <div className="flex items-center gap-3"><Library size={18} /> <span className="text-xs font-black uppercase tracking-widest">{shelf.name}</span></div>
                      <span className="text-[10px] font-black opacity-40">{books.filter(b => b.shelfId === shelf.id).length}</span>
                    </button>
                    <button onClick={(e) => handleDeleteShelf(e, shelf.id)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="pt-8 space-y-4">
                <button onClick={() => { setIsAddingShelf(true); setIsSidebarOpen(false); }} className="w-full py-4 rounded-2xl border border-dashed border-white/10 text-white/40 hover:border-white/30 hover:text-white transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"><Plus size={16} /> {t.newShelf}</button>
                <div className="flex gap-2">
                  <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="flex-1 p-4 rounded-2xl bg-white/5 text-white/40 hover:text-white transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"><Globe size={16} /> {lang === 'ar' ? 'EN' : 'AR'}</button>
                  <button onClick={() => setView(ViewState.DASHBOARD)} className="flex-1 p-4 rounded-2xl bg-white/5 text-white/40 hover:text-white transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest"><LayoutDashboard size={16} /></button>
                </div>
              </div>
            </MotionAside>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col relative">
          <AnimatePresence mode="wait">
            {view === ViewState.SHELF && (
              <MotionDiv key="shelf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                <header className="p-6 md:p-10 flex items-center justify-between relative z-50">
                  <div className="flex items-center gap-4 md:gap-8">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-3 md:p-4 rounded-full bg-white/5 text-white/40 hover:text-white transition-all hover:scale-110 active:scale-90"><Menu size={20} className="md:size-6" /></button>
                    <div className="flex flex-col">
                      <h1 className="text-2xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-none">{activeShelfId === 'default' ? t.defaultShelf : shelves.find(s => s.id === activeShelfId)?.name}</h1>
                      <span className="text-[8px] md:text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-1 md:mt-2">{t.sanctuary}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:gap-10 bg-white/[0.02] border border-white/5 px-4 md:px-8 py-3 md:py-5 rounded-full backdrop-blur-xl">
                    <MotionDiv key={`min-${activeBookIndex}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center relative z-10">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <Clock size={10} className="text-[#ff0000] md:size-3" />
                        <span className="text-xs md:text-lg font-black text-white">{activeBookStats.minutes}{lang === 'ar' ? 'د' : 'm'}</span>
                      </div>
                      <span className="text-[6px] md:text-[8px] font-black uppercase tracking-widest opacity-20">{lang === 'ar' ? 'دقائق الكتاب' : 'Book Minutes'}</span>
                    </MotionDiv>
                    <div className="w-[1px] h-4 md:h-6 bg-white/10 relative z-10" />
                    <MotionDiv key={`star-${activeBookIndex}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center relative z-10">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <Star size={10} className="text-[#ff0000] fill-[#ff0000] md:size-3" />
                        <span className="text-xs md:text-lg font-black text-white">{activeBookStats.stars}</span>
                      </div>
                      <span className="text-[6px] md:text-[8px] font-black uppercase tracking-widest opacity-20">{t.stars}</span>
                    </MotionDiv>
                  </div>
                </header>
                <div className="mt-4 mb-2 flex justify-center px-6 pointer-events-none min-h-[40px]">
                  <AnimatePresence mode="wait">
                    {showInsights && insights.length > 0 && (
                      <MotionDiv key={activeInsightIndex} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 0.9 }} exit={{ y: -20, opacity: 0 }} className={`flex items-center gap-2 px-5 py-3 rounded-full border border-white/10 backdrop-blur-2xl ${insights[activeInsightIndex % insights.length].color}`}>
                        {insights[activeInsightIndex % insights.length].icon}
                        <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.1em] text-white whitespace-nowrap">{insights[activeInsightIndex % insights.length].text}</span>
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex-1 flex flex-col justify-center items-center pb-12 md:pb-20">
                  <Shelf books={filteredBooks} lang={lang} activeIndex={activeBookIndex} onActiveIndexChange={setActiveBookIndex} onSelectBook={(b) => { setSelectedBook(b); setView(ViewState.READER); }} onAddBook={() => setIsAddingBook(true)} onDeleteBook={(b) => setBookToDelete(b)} />
                </div>
              </MotionDiv>
            )}
            {view === ViewState.DASHBOARD && (
              <MotionDiv key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[4000] bg-[#020502] overflow-y-auto custom-scroll flex flex-col">
                <Dashboard books={books} shelves={shelves} collectiveSessions={collectiveSessions} lang={lang} onBack={() => setView(ViewState.SHELF)} />
              </MotionDiv>
            )}
            {view === ViewState.READER && selectedBook && (
              <MotionDiv key="reader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[5000]">
                <Reader book={selectedBook} lang={lang} userId={userId} onBack={handleReaderBack} onStatsUpdate={handleStatsUpdate} socket={socket} roomId={roomId} roomData={roomData} />
              </MotionDiv>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showOnboarding && <Onboarding lang={lang} onComplete={handleOnboardingComplete} />}
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
                    {isCollectivePending && <input type="text" value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder={lang === 'ar' ? 'اسم الجلسة (اختياري)' : 'Session Name (Optional)'} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 text-xs md:text-sm font-bold text-white outline-none focus:border-[#ff0000]/50" />}
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
          {isJoiningRoom && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[6000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
              <MotionDiv initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-10 md:p-12 rounded-[2.5rem] md:rounded-[4rem] w-full max-w-md shadow-2xl text-center">
                <h3 className="text-2xl md:text-3xl font-black uppercase italic text-white mb-8 md:mb-10">{lang === 'ar' ? 'انضمام للجلسة' : 'Join Session'}</h3>
                <input autoFocus type="text" value={joinRoomInput} onChange={e => setJoinRoomInput(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl p-4 md:p-6 text-xs md:text-sm font-bold text-white outline-none mb-8 md:mb-10 focus:border-emerald-500/50" placeholder={lang === 'ar' ? 'معرف الغرفة...' : 'Room ID...'} />
                <div className="flex gap-3">
                  <button onClick={() => setIsJoiningRoom(false)} className="flex-1 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] font-black text-[10px] md:text-xs uppercase text-white/40 hover:text-white transition-all">{lang === 'ar' ? 'تراجع' : 'Cancel'}</button>
                  <button onClick={handleJoinRoom} className="flex-1 bg-emerald-600 py-4 md:py-6 rounded-[1.5rem] md:rounded-[2rem] font-black text-[10px] md:text-xs uppercase shadow-2xl hover:scale-105 transition-transform text-white tracking-[0.3em] md:tracking-[0.4em]">{lang === 'ar' ? 'انضمام' : 'Join'}</button>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
          {celebrationStar && <CelebrationOverlay starCount={celebrationStar} lang={lang} onComplete={handleCelebrationComplete} />}
          {bookToDelete && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[7000] flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-3xl">
              <MotionDiv initial={{ scale: 0.9, y: 40 }} animate={{ scale: 1, y: 0 }} className="bg-[#0b140b] border border-white/10 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] w-full max-w-md shadow-[0_30px_100px_rgba(255,0,0,0.15)] relative text-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-600/10 flex items-center justify-center mx-auto mb-6 border border-red-600/20 shadow-[0_0_40px_rgba(255,0,0,0.1)]"><Trash2 className="text-red-600" size={32} /></div>
                  <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic mb-3">{lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?'}</h2>
                  <p className="text-xs md:text-sm text-white/60 font-bold leading-relaxed mb-6">{lang === 'ar' ? `أنت على وشك حذف "${bookToDelete.title}". سيتم مسح جميع ملاحظاتك وتعديلاتك وإحصائيات القراءة لهذا الكتاب نهائياً.` : `You are about to delete "${bookToDelete.title}". All your notes, annotations, and reading stats for this book will be permanently erased.`}</p>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <p className="text-[9px] text-red-600/60 uppercase font-black tracking-widest">{lang === 'ar' ? 'اكتب العبارة التالية للتأكيد:' : 'Type the following phrase to confirm:'}</p>
                      <p className="text-base font-black text-white italic tracking-tighter">{lang === 'ar' ? 'امسح من المحراب' : 'DELETE FROM SANCTUARY'}</p>
                      <input type="text" value={deleteConfirmInput} onChange={(e) => setDeleteConfirmInput(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-white text-center focus:outline-none focus:border-red-600/50 transition-all font-bold text-base" placeholder="..." />
                    </div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <button onClick={() => { setBookToDelete(null); setDeleteConfirmInput(''); }} className="flex-1 bg-white/5 text-white/40 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all order-2 md:order-1">{lang === 'ar' ? 'تراجع' : 'Cancel'}</button>
                      <button onClick={confirmDeleteBook} disabled={deleteConfirmInput !== 'امسح من المحراب' && deleteConfirmInput !== 'DELETE FROM SANCTUARY'} className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-2xl order-1 md:order-2 ${deleteConfirmInput === 'امسح من المحراب' || deleteConfirmInput === 'DELETE FROM SANCTUARY' ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}>{lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}</button>
                    </div>
                  </div>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default App;
