
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ViewState, Language, Insight } from './types';
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
  const [activeInsightIndex, setActiveInsightIndex] = useState(0);
  const [showInsights, setShowInsights] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  useEffect(() => {
    const onboardingSeen = localStorage.getItem('sanctuary_onboarding_seen');
    const actualBooks = storageService.getBooks();
    // Only show if never seen AND library is truly empty (new user)
    if (!onboardingSeen && actualBooks.length === 0) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('sanctuary_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  const confirmDeleteBook = async () => {
    if (!bookToDelete || deleteConfirmInput !== 'امسح من المحراب') return;
    
    await pdfStorage.deleteFile(bookToDelete.id);
    storageService.deleteBook(bookToDelete.id);
    
    const updatedBooks = storageService.getBooks();
    setBooks(updatedBooks);
    setBookToDelete(null);
    setDeleteConfirmInput('');
    
    // Reset index if needed
    if (activeBookIndex >= updatedBooks.filter(b => b.shelfId === activeShelfId).length) {
      setActiveBookIndex(Math.max(0, updatedBooks.filter(b => b.shelfId === activeShelfId).length - 1));
    }
  };

  useEffect(() => {
    if (view === ViewState.SHELF) {
      setShowInsights(true);
      const timer = setTimeout(() => {
        setShowInsights(false);
      }, 45000);
      return () => clearTimeout(timer);
    } else {
      setShowInsights(false);
    }
  }, [view]);

  useEffect(() => {
    const loadedBooks = storageService.getBooks();
    const loadedShelves = storageService.getShelves();
    setBooks(loadedBooks);
    setShelves(loadedShelves);
  }, []);

  const t = translations[lang];
  const filteredBooks = books.filter(b => b.shelfId === activeShelfId);
  const fontClass = lang === 'ar' ? 'font-ar' : 'font-en';

  const habitData = useMemo(() => storageService.getHabitData(), [books]);
  const habitStreak = habitData.streak;

  const totalTodayMinutes = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return Math.floor(books.reduce((acc, b) => {
      if (b.lastReadDate === today) return acc + (b.dailyTimeSeconds || 0);
      return acc;
    }, 0) / 60);
  }, [books]);

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

  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];
    const isRTL = lang === 'ar';
    const streak = habitData.streak;
    
    // 0. First Experience / Empty State (Strictly Exclusive)
    if (books.length === 0) {
      list.push({
        text: isRTL ? 'مرحباً بك في طبقة النخبة.. هنا نصنع الوعي ونعيد صياغة الفكر.' : 'Welcome to the elite.. Here we craft awareness and reshape thought.',
        icon: <Sparkles size={16} className="text-[#ff0000] drop-shadow-[0_0_8px_rgba(255,0,0,0.6)]" />,
        color: 'border-[#ff0000]/40 bg-[#ff0000]/10 backdrop-blur-md shadow-[0_10px_30px_rgba(255,0,0,0.1)]',
        isShining: true
      });
      list.push({
        text: isRTL ? 'قاعدة الـ 3%: تحسن طفيف يومياً يجعلك في القمة خلال عام واحد.' : 'The 3% Rule: Slight daily improvement puts you at the top within a year.',
        icon: <Zap size={16} className="text-emerald-400" />,
        color: 'border-emerald-500/30 bg-emerald-500/5',
        isShining: false
      });
      list.push({
        text: isRTL ? '«القراءة هي تذكرة سفر للارتقاء من العامة إلى الخاصة.» — ابدأ الآن.' : '"Reading is a ticket to elevate from the common to the elite." — Start now.',
        icon: <BrainCircuit size={16} className="text-purple-400" />,
        color: 'border-purple-500/20 bg-purple-500/5',
        isShining: true
      });
      list.push({
        text: isRTL ? 'فعل القراءة ليس مجرد اطلاع، بل هو تمرين يومي لعضلة الحكمة.' : 'The act of reading is not just information, it is a daily exercise for the wisdom muscle.',
        icon: <BookOpen size={16} className="text-blue-400" />,
        color: 'border-blue-500/20 bg-blue-500/5',
        isShining: false
      });
      list.push({
        text: isRTL ? 'اضغط على (+) لتضع أول لبنة في صرح ثقافتك العظيمة.' : 'Click (+) to lay the first brick in the monument of your great culture.',
        icon: <Plus size={18} className="text-white animate-pulse" />,
        color: 'border-white/20 bg-white/5 shadow-xl',
        isShining: true
      });
      
      return list; // Return early so daily habit notes don't show for empty state
    }

    // 1. Rescue Alert (Only for active users)
    if (totalTodayMinutes < 2) {
      list.push({
        text: isRTL ? 'تنبيه: السلسلة في خطر! تحتاج جلسة إنقاذ (دقيقتان) الآن.' : 'Streak at risk! You need a 2-min Rescue Session now.',
        icon: <Zap size={14} className="text-orange-500 animate-pulse" />,
        color: 'border-orange-500/30 bg-orange-500/5'
      });
    } else if (totalTodayMinutes < 15) {
      list.push({
        text: isRTL ? `تم الإنقاذ! اقرأ ${15 - totalTodayMinutes} دقائق إضافية للتقدم في مسار الـ 40 يوماً.` : `Rescue complete! Read ${15 - totalTodayMinutes} more mins to advance the 40-day path.`,
        icon: <Check size={14} className="text-emerald-500" />,
        color: 'border-emerald-500/30 bg-emerald-500/5'
      });
    }

    // 2. Phase Info
    let phaseName = '';
    let phaseColor = '';
    if (streak <= 10) {
      phaseName = isRTL ? 'مرحلة المقاومة' : 'Resistance Phase';
      phaseColor = 'text-red-500';
    } else if (streak <= 21) {
      phaseName = isRTL ? 'مرحلة التثبيت' : 'Installation Phase';
      phaseColor = 'text-orange-500';
    } else {
      phaseName = isRTL ? 'مرحلة الانصهار' : 'Integration Phase';
      phaseColor = 'text-emerald-500';
    }
    
    list.push({
      text: isRTL ? `أنت في ${phaseName} (اليوم ${streak}/40)` : `You are in ${phaseName} (Day ${streak}/40)`,
      icon: <BrainCircuit size={14} className={phaseColor} />,
      color: 'border-white/10 bg-white/5'
    });

    // 3. Shield Progress
    if (habitData.shields < 3) {
      const daysLeft = 7 - habitData.consecutiveFullDays;
      list.push({
        text: isRTL ? `اقرأ 15 دقيقة لمدة ${daysLeft} أيام إضافية للحصول على درع جديد.` : `Read 15 mins for ${daysLeft} more days to earn a new shield.`,
        icon: <ShieldCheck size={14} className="text-emerald-400" />,
        color: 'border-emerald-400/20 bg-emerald-400/5'
      });
    }

    // 4. Shield Usage Advice
    if (habitData.shields > 0) {
      list.push({
        text: isRTL ? `لديك ${habitData.shields} دروع. سيتم استخدامها تلقائياً إذا فاتك يوم.` : `You have ${habitData.shields} shields. They're used automatically if you miss a day.`,
        icon: <ShieldCheck size={14} className="text-blue-500" />,
        color: 'border-blue-500/30 bg-blue-500/5'
      });
    }

    // 5. Library Stats
    const totalBooks = books.length;
    if (totalBooks > 0) {
      list.push({
        text: isRTL ? `محرابك يحتوي الآن على ${totalBooks} كتاباً.` : `Your sanctuary now holds ${totalBooks} volumes.`,
        icon: <Library size={14} className="text-purple-400" />,
        color: 'border-purple-400/20 bg-purple-400/5'
      });
    }

    // 6. Total Time Stats
    const totalSeconds = books.reduce((acc, b) => acc + b.timeSpentSeconds, 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);
    if (parseFloat(totalHours) > 0) {
      list.push({
        text: isRTL ? `إجمالي وقت الحكمة المتراكم: ${totalHours} ساعة.` : `Total wisdom accumulated: ${totalHours} hours.`,
        icon: <Clock size={14} className="text-yellow-400" />,
        color: 'border-yellow-400/20 bg-yellow-400/5'
      });
    }

    // 7. General Encouragement
    list.push({
      text: isRTL ? 'الاستمرارية هي مفتاح المعرفة العميقة.' : 'Consistency is the key to deep knowledge.',
      icon: <Sparkles size={14} className="text-white/40" />,
      color: 'border-white/5 bg-white/[0.02]'
    });

    return list;
  }, [habitData, totalTodayMinutes, lang, books]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const timer = setInterval(() => {
      setActiveInsightIndex(prev => (prev + 1) % insights.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [insights]);

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
      <div className={`flex flex-col h-screen-safe overflow-y-auto custom-scroll ${fontClass}`}>
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
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,0,0,0.05),transparent_70%)] pointer-events-none" />
                <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5 shrink-0 relative z-10">
                   <div className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-[#ff0000] flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.3)]">
                      <Sparkles size={16} className="text-white" />
                    </div>
                    <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter text-white">{t.menu}</h2>
                   </div>
                   <button onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-full bg-white/5 text-white/40 hover:text-white transition-all"><X size={18}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 space-y-8 md:space-y-10 relative z-10">
                  <button onClick={() => { setView(ViewState.DASHBOARD); setIsSidebarOpen(false); }} className="w-full flex items-center gap-4 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] bg-[#ff0000]/10 border border-[#ff0000]/20 hover:bg-[#ff0000] hover:border-[#ff0000] transition-all group shadow-lg shadow-red-900/10">
                    <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-white/10 group-hover:bg-white/20"><LayoutDashboard size={20} className="text-[#ff0000] group-hover:text-white" /></div>
                    <div className="flex flex-col items-start"><span className="text-[10px] md:text-xs font-black uppercase tracking-widest group-hover:text-white">{t.dashboard}</span><span className="text-[8px] md:text-[9px] uppercase font-black opacity-30 group-hover:opacity-60 group-hover:text-white">{t.cognitiveMetrics}</span></div>
                  </button>
                  
                  <section className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-3 opacity-20 px-2"><Globe size={12} className="text-white" /><span className="text-[9px] font-black uppercase tracking-widest text-white">{t.language}</span></div>
                    <div className="flex flex-col gap-2">
                      {['ar', 'en'].map((l) => (
                        <button key={l} onClick={() => { setLang(l as Language); setIsSidebarOpen(false); }} className={`w-full p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all flex items-center justify-between ${lang === l ? 'bg-white text-black border-white shadow-xl' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:border-white/10'}`}>
                          <span className="text-xs md:text-sm font-bold uppercase">{l === 'ar' ? 'العربية' : 'English'}</span>
                          {lang === l && <div className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                        </button>
                      ))}
                    </div>
                  </section>
                  
                  <section className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-3 opacity-20 px-2"><BrainCircuit size={12} className="text-white" /><span className="text-[9px] font-black uppercase tracking-widest text-white">{lang === 'ar' ? 'طريقة عمل التطبيق' : 'How it Works'}</span></div>
                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-3 shadow-inner">
                      <p className="text-[10px] font-bold text-white/50 leading-relaxed uppercase tracking-tight">
                        {lang === 'ar' 
                          ? 'يعتمد التطبيق على مسار الـ 40 يوماً لبناء عادة القراءة العميقة، مقسمة لثلاث مراحل: المقاومة، التثبيت، والانصهار التام.' 
                          : 'The app uses a 40-day path to build deep reading habits, divided into three phases: Resistance, Installation, and Integration.'}
                      </p>
                    </div>
                  </section>

                  <section className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-3 opacity-20 px-2"><ShieldCheck size={12} className="text-white" /><span className="text-[9px] font-black uppercase tracking-widest text-white">{lang === 'ar' ? 'سياسة التطبيق' : 'App Policy'}</span></div>
                    <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4 shadow-inner">
                      <ul className="space-y-3">
                        <li className="flex gap-3 text-[9px] font-black uppercase text-white/40 group">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                          <span className="group-hover:text-white/60 transition-colors">{lang === 'ar' ? 'جلسة الإنقاذ (2 دقيقة) تحمي السلسلة.' : 'Rescue Session (2 min) saves streak.'}</span>
                        </li>
                        <li className="flex gap-3 text-[9px] font-black uppercase text-white/40 group">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          <span className="group-hover:text-white/60 transition-colors">{lang === 'ar' ? 'درع كل 7 أيام أو عند النجمة 5.' : 'Shield every 7 days or at 5th star.'}</span>
                        </li>
                        <li className="flex gap-3 text-[9px] font-black uppercase text-white/40 group">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                          <span className="group-hover:text-white/60 transition-colors">{lang === 'ar' ? 'الحد الأقصى للدروع هو 3.' : 'Maximum shields allowed is 3.'}</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  <section className="space-y-4 pb-12">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3 opacity-20">
                        <Library size={12} className="text-white" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white">{t.collections}</span>
                      </div>
                      <button 
                        onClick={() => setIsAddingShelf(true)} 
                        className="p-2 bg-white/5 rounded-full text-white/40 hover:bg-red-600 hover:text-white transition-all active:scale-90 shadow-lg"
                      >
                        <Plus size={12}/>
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {shelves.map(shelf => (
                        <div 
                          key={shelf.id} 
                          onClick={() => { setActiveShelfId(shelf.id); setActiveBookIndex(0); setView(ViewState.SHELF); setIsSidebarOpen(false); }} 
                          className={`group w-full text-left px-5 py-4 rounded-2xl border transition-all text-[10px] md:text-xs font-bold flex items-center justify-between cursor-pointer ${activeShelfId === shelf.id ? 'bg-white/10 border-white/20 text-white shadow-xl' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5'}`}
                        >
                          <div className="flex items-center gap-4 truncate">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeShelfId === shelf.id ? 'bg-red-600 shadow-[0_0_8px_#ff0000]' : 'bg-white/10'}`} />
                            <span className="truncate">{shelf.name}</span>
                          </div>
                          {shelf.id !== 'default' && (
                            <button 
                              onClick={(e) => handleDeleteShelf(e, shelf.id)} 
                              className="p-2 text-white/0 group-hover:text-white/20 hover:text-red-600 transition-all rounded-lg hover:bg-white/5"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-4 pb-12">
                    <div className="flex items-center gap-3 opacity-20 px-2">
                      <Mail size={12} className="text-white" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white">
                        {lang === 'ar' ? 'الدعم الفني' : 'Support'}
                      </span>
                    </div>
                    <a 
                      href={`mailto:oussama.sebrou@gmail.com?subject=${encodeURIComponent(lang === 'ar' ? 'استفسار رسمي: تطبيق المحراب للقراءة' : 'Official Inquiry: Sanctuary Reader Application')}&body=${encodeURIComponent(lang === 'ar' ? 'إلى فريق تطوير تطبيق المحراب،\n\nأكتب إليكم بصفتي مستخدماً للمنصة، وأود تقديم الملاحظات التالية لتعزيز التجربة المعرفية:\n\n[اكتب رسالتك هنا]\n\nمع خالص التقدير،\n[اسمك]' : 'To the Sanctuary Development Team,\n\nI am writing to you as a user of the platform, and I would like to provide the following feedback to enhance the cognitive experience:\n\n[Your Message Here]\n\nBest regards,\n[Your Name]')}`}
                      className="w-full flex items-center gap-4 p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition-all group shadow-xl"
                    >
                      <div className="p-3 rounded-2xl bg-red-600/10 group-hover:bg-red-600/20 transition-colors">
                        <Mail size={20} className="text-red-600" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-white group-hover:text-red-500 transition-colors">
                          {lang === 'ar' ? 'فريق دعم المحراب' : 'Contact Us Sanctuary Team'}
                        </span>
                        <span className="text-[8px] md:text-[9px] uppercase font-black opacity-20 text-white">
                          Official Support Channel
                        </span>
                      </div>
                    </a>
                  </section>

                  <div className="pt-8 pb-12 text-center border-t border-white/5">
                    <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/10">
                      Sanctuary Reader v2.1.0
                    </span>
                  </div>
                </div>
              </MotionAside>
            </React.Fragment>
          )}
        </AnimatePresence>

        {/* Global Fixed Controls - Elevated z-index to ensure visibility and clickability */}
        <div className="fixed top-0 left-0 right-0 z-[3000] p-3 md:p-8 pointer-events-none flex justify-between items-center">
          <button 
            onClick={() => setIsSidebarOpen(true)} 
            className="p-3 md:p-5 rounded-full bg-black/60 backdrop-blur-2xl border border-white/10 pointer-events-auto hover:bg-[#ff0000] hover:border-[#ff0000] transition-all shadow-2xl group active:scale-95 z-[3001]"
          >
            <Menu size={18} className="group-hover:text-white text-white/40 md:size-6"/>
          </button>
          
          {view === ViewState.SHELF && (
            <div className="flex flex-row items-center gap-1.5 md:gap-3 pointer-events-auto max-w-[80vw] justify-end">
              <MotionDiv initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 md:gap-3 bg-black/60 backdrop-blur-xl px-3 py-2 md:px-6 md:py-3.5 rounded-full border border-[#ff0000]/30 shadow-xl shrink-0">
                <Clock size={14} className="text-[#ff0000] animate-pulse md:size-4" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest opacity-30 mb-0.5">{t.todayFocus}</span>
                  <span className="text-[9px] md:text-[11px] font-black text-[#ff0000]">{totalTodayMinutes}{lang === 'ar' ? 'د' : 'm'}</span>
                </div>
              </MotionDiv>
              
              {habitStreak > 0 && (
                <MotionDiv initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 md:gap-3 bg-black/60 backdrop-blur-xl px-3 py-2 md:px-6 md:py-3.5 rounded-full border border-orange-500/30 shadow-xl shrink-0">
                  <Zap size={14} className="text-orange-500 md:size-4" />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest opacity-30 mb-0.5">{lang === 'ar' ? 'الاستمرارية' : 'Streak'}</span>
                    <span className="text-[9px] md:text-[11px] font-black text-orange-500">{habitStreak}{lang === 'ar' ? 'ي' : 'd'}</span>
                  </div>
                </MotionDiv>
              )}

              <button onClick={() => setIsAddingBook(true)} className="px-4 md:px-8 py-2.5 md:py-4 rounded-full bg-white text-black text-[8px] md:text-[11px] font-black uppercase tracking-[0.1em] md:tracking-[0.3em] shadow-2xl hover:bg-[#ff0000] hover:text-white transition-all flex items-center gap-1.5 active:scale-95 shrink-0">
                <Plus size={12} className="md:size-3.5" />{lang === 'ar' ? 'إضافة' : 'Add'}
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
                  <div className="mt-3 md:mt-2 flex items-center gap-3 md:gap-8 bg-black/40 backdrop-blur-3xl px-4 md:px-8 py-1.5 md:py-2 rounded-full border border-white/10 shadow-3xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />
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
                    {activeBookStats.stars > 0 && (
                      <>
                        <div className="w-[1px] h-4 md:h-6 bg-white/10 relative z-10" />
                        <MotionDiv initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col items-center relative z-10">
                          <div className="flex items-center gap-1.5 md:gap-2">
                            <Sparkles size={10} className="text-yellow-500 md:size-3" />
                            <span className="text-[9px] md:text-xs font-black text-white uppercase tracking-tighter">{t.badges[activeBookStats.stars - 1]}</span>
                          </div>
                          <span className="text-[6px] md:text-[8px] font-black uppercase tracking-widest opacity-20">{lang === 'ar' ? 'الوسام الحالي' : 'Current Badge'}</span>
                        </MotionDiv>
                      </>
                    )}
                  </div>
                </header>

                {/* Habit Insights Overlay - Moved here as per user request */}
                <div className="mt-4 mb-2 flex justify-center px-6 pointer-events-none min-h-[40px]">
                  <AnimatePresence mode="wait">
                    {showInsights && insights.length > 0 && (
                      <MotionDiv
                        key={activeInsightIndex}
                        initial={{ y: 20, opacity: 0, rotateX: -45, scale: 0.9 }}
                        animate={{ y: 0, opacity: 0.9, rotateX: 0, scale: 1 }}
                        exit={{ y: -20, opacity: 0, rotateX: 45, scale: 0.9 }}
                        transition={{ type: "spring", damping: 15, stiffness: 100 }}
                        className={`flex items-center gap-2 px-5 py-3 rounded-full border border-white/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto transition-all duration-700 ${insights[activeInsightIndex % insights.length].color}`}
                        style={{ perspective: '1000px' }}
                      >
                        <div className="shrink-0 scale-90 md:scale-100">
                          {insights[activeInsightIndex % insights.length].icon}
                        </div>
                        <span className={`text-[9px] md:text-[11px] font-black uppercase tracking-[0.1em] text-white whitespace-nowrap ${insights[activeInsightIndex % insights.length].isShining ? 'shining-text' : ''}`}>
                          {insights[activeInsightIndex % insights.length].text}
                        </span>
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                </div>
                
                <div className="flex-1 flex flex-col justify-center items-center pb-12 md:pb-20">
                  <Shelf 
                    books={filteredBooks} 
                    lang={lang} 
                    activeIndex={activeBookIndex}
                    onActiveIndexChange={setActiveBookIndex}
                    onSelectBook={(b) => { setSelectedBook(b); setView(ViewState.READER); }} 
                    onAddBook={() => setIsAddingBook(true)} 
                    onDeleteBook={(b) => setBookToDelete(b)}
                  />
                </div>
                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none opacity-5">
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.6em] text-white">Developed By Oussama SEBROU</span>
                </div>
              </MotionDiv>
            )}
            {view === ViewState.DASHBOARD && (
              <MotionDiv 
                key="dashboard" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="fixed inset-0 z-[4000] bg-[#020502] overflow-y-auto custom-scroll flex flex-col"
              >
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
          {showOnboarding && (
            <Onboarding lang={lang} onComplete={handleOnboardingComplete} />
          )}
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

          {bookToDelete && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[7000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
              <MotionDiv initial={{ scale: 0.9, y: 40 }} animate={{ scale: 1, y: 0 }} className="bg-[#0b140b] border border-white/10 p-10 md:p-14 rounded-[4rem] w-full max-w-lg shadow-[0_30px_100px_rgba(255,0,0,0.15)] relative text-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent pointer-events-none" />
                
                <div className="relative z-10">
                  <div className="w-24 h-24 rounded-full bg-red-600/10 flex items-center justify-center mx-auto mb-8 border border-red-600/20 shadow-[0_0_40px_rgba(255,0,0,0.1)]">
                    <Trash2 className="text-red-600" size={40} />
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter italic mb-4">
                    {lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?'}
                  </h2>
                  
                  <p className="text-sm md:text-base text-white/60 font-bold leading-relaxed mb-8">
                    {lang === 'ar' 
                      ? `أنت على وشك حذف "${bookToDelete.title}". سيتم مسح جميع ملاحظاتك وتعديلاتك وإحصائيات القراءة لهذا الكتاب نهائياً.` 
                      : `You are about to delete "${bookToDelete.title}". All your notes, annotations, and reading stats for this book will be permanently erased.`}
                  </p>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <p className="text-[10px] text-red-600/60 uppercase font-black tracking-widest">
                        {lang === 'ar' ? 'اكتب العبارة التالية للتأكيد:' : 'Type the following phrase to confirm:'}
                      </p>
                      <p className="text-lg font-black text-white italic tracking-tighter">امسح من المحراب</p>
                      <input 
                        type="text" 
                        value={deleteConfirmInput} 
                        onChange={(e) => setDeleteConfirmInput(e.target.value)} 
                        className="w-full bg-white/[0.03] border border-white/10 rounded-3xl px-8 py-5 text-white text-center focus:outline-none focus:border-red-600/50 transition-all font-bold text-lg" 
                        placeholder="..."
                      />
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4">
                      <button 
                        onClick={() => { setBookToDelete(null); setDeleteConfirmInput(''); }} 
                        className="flex-1 bg-white/5 text-white/40 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] hover:bg-white/10 hover:text-white transition-all"
                      >
                        {lang === 'ar' ? 'تراجع' : 'Cancel'}
                      </button>
                      <button 
                        onClick={confirmDeleteBook}
                        disabled={deleteConfirmInput !== 'امسح من المحراب'}
                        className={`flex-1 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] transition-all shadow-2xl ${deleteConfirmInput === 'امسح من المحراب' ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95' : 'bg-white/5 text-white/10 cursor-not-allowed'}`}
                      >
                        {lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}
                      </button>
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
