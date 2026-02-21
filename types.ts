
export enum ViewState {
  SHELF = 'SHELF',
  READER = 'READER',
  DASHBOARD = 'DASHBOARD',
  VAULT = 'VAULT'
}

export type Language = 'en' | 'ar';

export interface Annotation {
  id: string;
  page: number;
  pageIndex: number;
  title: string;
  chapter?: string;
  content?: string;
  text?: string;
  timestamp: number;
  color: string;
  type?: 'highlight' | 'underline' | 'box' | 'note';
  rect?: { x: number, y: number, w: number, h: number };
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface Book {
  id: string;
  shelfId: string;
  title: string;
  author: string;
  cover: string;
  content: string;
  timeSpentSeconds: number;
  dailyTimeSeconds: number;
  lastReadDate: string;
  stars: number;
  addedAt: number;
  lastPage: number;
  annotations: Annotation[];
  lastReadAt?: number;
}

export interface ShelfData {
  id: string;
  name: string;
  color: string;
}

export interface FlashCard {
  id: string;
  bookId: string;
  front: string;
  back: string;
  content?: string;
  addedAt: number;
  createdAt?: number;
}

export interface HabitData {
  history: string[];
  missedDays: string[];
  shields: number;
  streak: number;
  lastUpdated: string;
  consecutiveFullDays: number;
}
