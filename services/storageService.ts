
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

// New non-linear thresholds in seconds: 15m, 30m, 50m, 135m, 180m
const STAR_THRESHOLDS = [900, 1800, 3000, 8100, 10800];

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
      books[index].timeSpentSeconds += seconds;
      
      // Calculate stars based on thresholds
      let stars = 0;
      for (const threshold of STAR_THRESHOLDS) {
        if (books[index].timeSpentSeconds >= threshold) {
          stars++;
        } else {
          break;
        }
      }
      
      books[index].stars = stars;
      books[index].lastReadAt = Date.now();
      storageService.saveBooks(books);
    }
  },

  getCards: (): FlashCard[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CARDS);
    return data ? JSON.parse(data) : [];
  }
};
