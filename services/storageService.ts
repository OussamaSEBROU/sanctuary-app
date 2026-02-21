
import type { Book, FlashCard, ShelfData, Annotation, HabitData } from '../types';

const STORAGE_KEYS = {
  BOOKS: 'sanctuary_books',
  SHELVES: 'sanctuary_shelves',
  CARDS: 'sanctuary_cards',
  SETTINGS: 'sanctuary_settings',
  HABIT: 'sanctuary_habit'
};

const DEFAULT_SHELF: ShelfData = {
  id: 'default',
  name: 'Main Sanctuary / المحراب الأساسي',
  color: '#ff0000'
};

// New non-linear thresholds in seconds: 15m, 30m, 50m, 140m, 200m, 260m, 320m
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

  updateBookStats: (bookId: string, seconds: number): { starReached: number | null } => {
    const books = storageService.getBooks();
    const index = books.findIndex(b => b.id === bookId);
    let starReached: number | null = null;

    if (index !== -1) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const book = books[index];
      const oldStars = book.stars || 0;

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
      
      if (stars > oldStars) {
        starReached = stars;
        // Award 2 shields when reaching the 5th star
        if (stars === 5) {
          const habit = storageService.getHabitData();
          habit.shields = Math.min(habit.shields + 2, 3);
          storageService.saveHabitData(habit);
        }
      }

      book.stars = stars;
      book.lastReadAt = Date.now();
      storageService.saveBooks(books);
      storageService.recordReadingDay();
    }
    return { starReached };
  },

  getCards: (): FlashCard[] => {
    const data = localStorage.getItem(STORAGE_KEYS.CARDS);
    return data ? JSON.parse(data) : [];
  },

  getHabitData: (): HabitData => {
    const data = localStorage.getItem(STORAGE_KEYS.HABIT);
    return data ? JSON.parse(data) : { 
      history: [], 
      missedDays: [], 
      shields: 2, 
      streak: 0, 
      lastUpdated: '',
      consecutiveFullDays: 0
    };
  },

  saveHabitData: (habit: HabitData) => {
    localStorage.setItem(STORAGE_KEYS.HABIT, JSON.stringify(habit));
  },

  recordReadingDay: () => {
    const today = new Date().toISOString().split('T')[0];
    const books = storageService.getBooks();
    const totalTodaySeconds = books.reduce((acc, b) => {
      const bDate = b.lastReadDate || (b.lastReadAt ? new Date(b.lastReadAt).toISOString().split('T')[0] : '');
      if (bDate === today) return acc + (b.dailyTimeSeconds || 0);
      return acc;
    }, 0);

    const habit = storageService.getHabitData();
    const FULL_DAY_THRESHOLD = 600; // 10 minutes
    const RESCUE_THRESHOLD = 120; // 2 minutes

    // If already recorded as full day today, nothing to do
    if (habit.lastUpdated === today && habit.history.includes(today)) return;

    // If not even a rescue session yet, return
    if (totalTodaySeconds < RESCUE_THRESHOLD) return;

    const isFullDay = totalTodaySeconds >= FULL_DAY_THRESHOLD;

    // Handle New Day
    if (habit.lastUpdated !== today) {
      if (habit.lastUpdated === '') {
        habit.streak = 1;
        habit.shields = 2;
        habit.consecutiveFullDays = isFullDay ? 1 : 0;
      } else {
        const lastDate = new Date(habit.lastUpdated);
        const todayDate = new Date(today);
        const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          habit.streak += 1;
          if (isFullDay) habit.consecutiveFullDays += 1;
          else habit.consecutiveFullDays = 0;
        } else {
          let streakBroken = false;
          for (let i = 1; i < diffDays; i++) {
            const gapDay = new Date(lastDate);
            gapDay.setDate(gapDay.getDate() + i);
            const gapDayStr = gapDay.toISOString().split('T')[0];
            
            if (habit.shields > 0) {
              habit.shields -= 1;
              habit.history.push(gapDayStr); // Shielded day counts as full for path
            } else {
              habit.missedDays.push(gapDayStr);
              streakBroken = true;
            }
          }
          
          if (streakBroken) {
            habit.streak = 1;
            habit.consecutiveFullDays = isFullDay ? 1 : 0;
          } else {
            habit.streak += 1;
            if (isFullDay) habit.consecutiveFullDays += 1;
            else habit.consecutiveFullDays = 0;
          }
        }
      }

      // Award Shield every 7 consecutive full days
      if (habit.consecutiveFullDays >= 7) {
        habit.shields = Math.min(habit.shields + 1, 3);
        habit.consecutiveFullDays = 0;
      }

      if (isFullDay) {
        habit.history.push(today);
      }
      habit.lastUpdated = today;
    } else {
      // It's already recorded as a Rescue today, checking if it's now a Full Day
      if (isFullDay && !habit.history.includes(today)) {
        habit.history.push(today);
        habit.consecutiveFullDays += 1;
        
        if (habit.consecutiveFullDays >= 7) {
          habit.shields = Math.min(habit.shields + 1, 3);
          habit.consecutiveFullDays = 0;
        }
      }
    }
    
    storageService.saveHabitData(habit);
  }
};
