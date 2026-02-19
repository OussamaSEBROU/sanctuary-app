import { Book, FlashCard, ShelfData, Annotation } from '../types';

const STORAGE_KEYS = {
  BOOKS: 'sanctuary_books',
  SHELVES: 'sanctuary_shelves',
  CARDS: 'sanctuary_cards',
  SETTINGS: 'sanctuary_settings'
};

const DEFAULT_SHELF: ShelfData = {
  id: 'default',
  name: 'Main Sanctuary / المحراب الأساسي',
  color: '#ff0000'
};

// Updated thresholds in seconds: 15m, 30m, 50m, 140m, 200m, 260m, 320m
const STAR_THRESHOLDS = [900, 1800, 3000, 8400, 12000, 15600, 19200];

export const storageService = {
  getShelves: (): ShelfData[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SHELVES);
    const shelves = data ? JSON.parse(data) : [DEFAULT_SHELF];
    return shelves;
  },

  saveShelves: (shelves: ShelfData[]) => {
    localStorage.setItem(STORAGE_KEYS.SHELVES, JSON.stringify(shelves));
  },

  getBooks: (): Book[] => {
    const data = localStorage.getItem(STORAGE_KEYS.BOOKS);
    const books: Book[] = data ? JSON.parse(data) : [];
    return books.map(b => ({ 
      ...b, 
      shelfId: b.shelfId || 'default',
      annotations: b.annotations || [] 
    }));
  },
  
  saveBooks: (books: Book[]) => {
    localStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(books));
  },

  updateBookAnnotations: (bookId: string, annotations: Annotation[]) => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === bookId);
    if (index !== -1) {
      books[index].annotations = annotations;
      storageService.saveBooks(books);
    }
  },

  updateBookPage: (bookId: string, page: number) => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === bookId);
    if (index !== -1) {
      books[index].lastPage = page;
      storageService.saveBooks(books);
    }
  },

  updateBookStats: (bookId: string, seconds: number) => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === bookId);
    if (index !== -1) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const book = books[index];

      // Reset daily counter if date changed
      if (book.lastReadDate !== today) {
        book.dailyTimeSeconds = 0;
        book.lastReadDate = today;
      }

      book.timeSpentSeconds += seconds;
      book.dailyTimeSeconds = (book.dailyTimeSeconds || 0) + seconds;
      
      // Calculate stars based on thresholds
      let stars = 0;
      for (const threshold of STAR_THRESHOLDS) {
        if (book.timeSpentSeconds >= threshold) {
          stars++;
        } else {
          break;
        }
      }
      
      const oldStars = book.stars || 0;
      book.stars = stars;
      book.lastReadAt = Date.now();
      storageService.saveBooks(books);
      
      // Return true if a new star was achieved
      return stars > oldStars;
    }
    return false;
  },

  getCards: (): FlashCard[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CARDS);
    return data ? JSON.parse(data) : [];
  }
};
