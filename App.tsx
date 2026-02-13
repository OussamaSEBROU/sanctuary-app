
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Book, Language, ShelfData } from './types';
import { Layout } from './components/Layout';
import { Shelf } from './components/Shelf';
import { Reader } from './components/Reader';
import { Vault } from './components/Vault';
import { Dashboard } from './components/Dashboard';
import { translations } from './i18n/translations';
import { storageService } from './services/storageService';
import { pdfStorage } from './services/pdfStorage';
import { 
  Plus, 
  Library, 
  X, 
  Upload, 
  Menu, 
  Sparkles, 
  Activity, 
  Trash2, 
  Loader2, 
  BookOpen, 
  Globe, 
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

declare const pdfjsLib: any;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.SHELF);
  const [lang, setLang] = useState<Language>('ar');
  const [books, setBooks] = useState<Book[]>([]);
  const [shelves, setShelves] = useState<ShelfData[]>([]);
  const [activeShelfId, setActiveShelfId] = useState<string>('default');
  
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

  useEffect(() => {
    const loadedBooks = storageService.getBooks();
    const loadedShelves = storageService.getShelves();
    setBooks(loadedBooks);
    setShelves(loadedShelves);
  }, []);

  const t = translations[lang];
  const filteredBooks = books.filter(b => b.shelfId === activeShelfId);
  const fontClass = lang === 'ar' ? 'font-ar' : 'font-en';

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
      id: bookId,
      shelfId: activeShelfId,
      title: newBookTitle,
      author: newBookAuthor || (lang === 'ar' ? 'مؤلف مجهول' : 'Unknown Scribe'),
      cover: `https://picsum.photos/seed/${newBookTitle}/800/1200`,
      content: "[VISUAL_PDF_MODE]",
      timeSpentSeconds: 0,
      stars: 0,
      addedAt: Date.now(),
      lastPage: 0,
      annotations: []
    };
    const updated = [newBook, ...books];
    setBooks(updated);
    storageService.saveBooks(updated);
    setNewBookTitle('');
    setNewBookAuthor('');
    setPendingFileData(null);
    setIsAddingBook(false);
  };

  const handleAddShelf = () => {
    if (!newShelfName) return;
    const newShelf: ShelfData = {
      id: Math.random().toString(36).substr(2, 9),
      name: newShelfName,
      color: '#ff0000'
    };
    const updated = [...shelves, newShelf];
    setShelves(updated);
    storageService.saveShelves(updated);
    setNewShelfName('');
    setIsAddingShelf(false);
  };

  const handleDeleteShelf = (e: React.MouseEvent, shelfId: string) => {
    e.stopPropagation();
    if (shelfId === 'default') return;
    const confirmMsg = lang === 'ar' ? 'هل أنت متأكد من حذف هذه المجموعة؟ سيتم نقل الكتب إلى المجموعة الأساسية.' : 'Are you sure you want to delete this collection? Books will be moved to the main Sanctuary.';
    if (!window.confirm(confirmMsg)) return;

    const updatedShelves = shelves.filter(s => s.id !== shelfId);
    setShelves(updatedShelves);
    storageService.saveShelves(updatedShelves);

    const updatedBooks = books.map(b => b.shelfId === shelfId ? { ...b, shelfId: 'default' } : b);
    setBooks(updatedBooks);
    storageService.saveBooks(updatedBooks);

    if (activeShelfId === shelfId) setActiveShelfId('default');
  };

  return (
    <Layout lang={lang}>
      <div className={`flex flex-col h-screen-safe overflow-hidden ${fontClass}`}>
        
        {/* Modern Vertical Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[500]" />
              <motion.aside
                initial={{ x: lang === 'ar' ? '100%' : '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: lang === 'ar' ? '100%' : '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed top-0 bottom-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-[85vw] md:w-80 bg-[#050f05] border-${lang === 'ar' ? 'l' : 'r'} border-white/5 z-[600] flex flex-col shadow-2xl`}
              >
                <div className="p-8 flex items-center justify-between border-b border-white/5">
                   <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#ff0000] flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.3)]">
                      <Sparkles size={20} className="text-white" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">{t.menu}</h2>
                   </div>
                   <button onClick={() => setIsSidebarOpen(false)} className="p-2.5 rounded-full bg-white/5 text-white/40 hover:text-white transition-all"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-10">
                  <button onClick={() => { setView(ViewState.DASHBOARD); setIsSidebarOpen(false); }} className="w-full flex items-center gap-4 p-5 rounded-[2rem] bg-[#ff0000]/10 border border-[#ff0000]/20 hover:bg-[#ff0000] hover:border-[#ff0000] transition-all group">
                    <div className="p-3 rounded-xl bg-white/10 group-hover:bg-white/20"><LayoutDashboard size={24} className="text-[#ff0000] group-hover:text-white" /></div>
                    <div className="flex flex-col items-start"><span className="text-xs font-black uppercase tracking-widest group-hover:text-white">{t.dashboard}</span><span className="text-[9px] uppercase font-black opacity-30 group-hover:opacity-60 group-hover:text-white">{t.cognitiveMetrics}</span></div>
                  </button>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3 opacity-20 px-2"><Globe size={14} /><span className="text-[10px] font-black uppercase tracking-widest">{t.language}</span></div>
                    <div className="flex flex-col gap-2">
                      {['ar', 'en'].map((l) => (
                        <button key={l} onClick={() => { setLang(l as Language); setIsSidebarOpen(false); }} className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${lang === l ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'}`}>
                          <span className="text-sm font-bold uppercase">{l === 'ar' ? 'العربية' : 'English'}</span>
                          {lang === l && <div className="w-2 h-2 rounded-full bg-red-600" />}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3 opacity-20"><Library size={14} /><span className="text-[10px] font-black uppercase tracking-widest">{t.collections}</span></div>
                      <button onClick={() => setIsAddingShelf(true)} className="p-1.5 bg-[#ff0000]/20 rounded-full text-[#ff0000] hover:scale-110 transition-transform"><Plus size={14}/></button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {shelves.map(shelf => (
                        <div key={shelf.id} onClick={() => { setActiveShelfId(shelf.id); setView(ViewState.SHELF); setIsSidebarOpen(false); }} className={`group w-full text-left px-5 py-4 rounded-2xl border transition-all text-xs font-bold flex items-center justify-between cursor-pointer ${activeShelfId === shelf.id ? 'bg-[#ff0000]/10 border-[#ff0000]/30 text-white' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5'}`}>
                          <div className="flex items-center gap-4 truncate"><div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeShelfId === shelf.id ? 'bg-[#ff0000]' : 'bg-white/10'}`} /><span className="truncate">{shelf.name}</span></div>
                          {shelf.id !== 'default' && <button onClick={(e) => handleDeleteShelf(e, shelf.id)} className="p-2 text-white/0 group-hover:text-white/20 hover:text-red-600 transition-all rounded-lg hover:bg-white/5"><Trash2 size={14} /></button>}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
                
                <div className="p-8 border-t border-white/5 bg-black/40"><div className="flex items-center gap-4"><Activity size={20} className="text-[#ff0000]" /><div><span className="text-[9px] font-black uppercase tracking-widest opacity-20 leading-none mb-1 block">{t.status}</span><span className="text-xs font-black uppercase tracking-tighter">{t.activeSession}</span></div></div></div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Global Toolbar */}
        <div className="fixed top-0 left-0 right-0 z-[100] p-6 pointer-events-none flex justify-between items-start">
          <button onClick={() => setIsSidebarOpen(true)} className="p-4 rounded-full bg-black/60 backdrop-blur-2xl border border-white/10 pointer-events-auto hover:bg-[#ff0000] hover:border-[#ff0000] transition-all shadow-2xl group">
            <Menu size={20} className="group-hover:text-white text-white/40"/>
          </button>
          
          {view === ViewState.SHELF && (
            <button onClick={() => setIsAddingBook(true)} className="px-8 py-4 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] pointer-events-auto shadow-2xl hover:bg-[#ff0000] hover:text-white transition-all flex items-center gap-3">
              <Plus size={14} />{lang === 'ar' ? 'إضافة كتاب' : 'Add Work'}
            </button>
          )}
        </div>

        <div className="flex-1 relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {view === ViewState.SHELF && (
              <motion.div key="shelf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                <header className="flex flex-col items-center text-center pt-24 pb-8 shrink-0">
                  <h1 className="text-[clamp(2rem,10vw,8rem)] font-black text-white uppercase big-title-white tracking-tighter px-4 leading-[0.8] text-center w-full max-w-full overflow-hidden">
                    {t.title}
                  </h1>
                  <p className="shining-text text-[11px] md:text-sm font-bold mt-8 px-12 max-w-2xl tracking-[0.3em] md:tracking-[0.4em] leading-relaxed opacity-80">
                    {t.philosophy}
                  </p>
                </header>
                <div className="flex-1"><Shelf books={filteredBooks} lang={lang} onSelectBook={(b) => { setSelectedBook(b); setView(ViewState.READER); }} onAddBook={() => setIsAddingBook(true)} /></div>
              </motion.div>
            )}
            
            {view === ViewState.DASHBOARD && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 overflow-y-auto custom-scroll">
                <Dashboard books={books} shelves={shelves} lang={lang} onBack={() => setView(ViewState.SHELF)} />
              </motion.div>
            )}

            {view === ViewState.READER && selectedBook && (
              <motion.div key="reader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[1000]">
                <Reader book={selectedBook} lang={lang} onBack={() => { setBooks(storageService.getBooks()); setView(ViewState.SHELF); }} onStatsUpdate={() => setBooks(storageService.getBooks())} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modals */}
        <AnimatePresence>
          {isAddingBook && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/98 backdrop-blur-3xl">
              <motion.div initial={{ scale: 0.95, y: 30 }} animate={{ scale: 1, y: 0 }} className="bg-[#0b140b] border border-white/5 p-12 rounded-[4rem] w-full max-w-xl shadow-2xl relative">
                <button onClick={() => setIsAddingBook(false)} className="absolute top-10 right-10 p-2 rounded-full bg-white/5 text-white/20 hover:text-white transition-colors"><X size={24} /></button>
                <h2 className="text-3xl font-black mb-12 text-white uppercase italic flex items-center gap-5 leading-none"><BookOpen size={44} className="text-[#ff0000]" /> {t.newIntake}</h2>
                <div className="space-y-8">
                  <div onClick={() => !isExtracting && fileInputRef.current?.click()} className="w-full aspect-video border-2 border-dashed border-white/10 rounded-[3rem] flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-[#ff0000]/30 transition-all bg-white/5 group">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf" />
                    {isExtracting ? <div className="animate-spin text-[#ff0000]"><Loader2 size={40} /></div> : <><div className="p-6 bg-white/5 rounded-full group-hover:bg-[#ff0000] group-hover:text-white transition-all"><Upload size={40} className="text-white/20" /></div><span className="text-[11px] uppercase font-black opacity-30 tracking-[0.3em]">{pendingFileData ? newBookTitle : t.uploadHint}</span></>}
                  </div>
                  <div className="grid gap-4">
                    <input type="text" value={newBookTitle} onChange={e => setNewBookTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm font-bold text-white outline-none focus:border-[#ff0000]/50" placeholder={t.bookTitle} />
                    <input type="text" value={newBookAuthor} onChange={e => setNewBookAuthor(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm font-bold text-white outline-none focus:border-[#ff0000]/50" placeholder={t.author} />
                  </div>
                  <button onClick={handleAddBook} disabled={!newBookTitle || !pendingFileData} className="w-full bg-white text-black py-6 rounded-[2rem] font-black text-xs uppercase shadow-2xl hover:bg-[#ff0000] hover:text-white transition-all tracking-[0.5em]">{t.save}</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAddingShelf && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#0b140b] border border-white/10 p-12 rounded-[4rem] w-full max-w-md shadow-2xl text-center">
                <h3 className="text-3xl font-black uppercase italic text-white mb-10">{lang === 'ar' ? 'إنشاء رف' : 'New Shelf'}</h3>
                <input autoFocus type="text" value={newShelfName} onChange={e => setNewShelfName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm font-bold text-white outline-none mb-10 focus:border-[#ff0000]/50" placeholder={lang === 'ar' ? 'اسم الرف...' : 'Shelf Name...'} />
                <button onClick={handleAddShelf} className="w-full bg-[#ff0000] py-6 rounded-[2rem] font-black text-xs uppercase shadow-2xl hover:scale-105 transition-transform text-white tracking-[0.4em]">{t.establish}</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

export default App;
