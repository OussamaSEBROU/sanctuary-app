
export interface ShelfData {
  id: string;
  name: string;
  color?: string;
}

export interface Annotation {
  id: string;
  type: 'highlight' | 'underline' | 'box' | 'note';
  pageIndex: number;
  x: number; // Percentage
  y: number; // Percentage
  width?: number; // Percentage
  height?: number; // Percentage
  text?: string; // For notes
  color: string;
}

export interface Book {
  id: string;
  shelfId: string;
  title: string;
  author: string;
  cover: string;
  content: string;
  timeSpentSeconds: number;
  stars: number;
  addedAt: number;
  lastReadAt?: number;
  annotations?: Annotation[];
}

export interface FlashCard {
  id: string;
  bookId: string;
  content: string;
  createdAt: number;
  nextReviewDate: number;
}

export enum ViewState {
  SHELF = 'SHELF',
  READER = 'READER',
  VAULT = 'VAULT',
  DASHBOARD = 'DASHBOARD'
}

export type Language = 'en' | 'ar';
