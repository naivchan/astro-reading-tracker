// src/lib/storage.ts
import { getStore } from '@netlify/blobs';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface DailyLog {
  date: string;
  pagesRead: number;
}

export interface Book {
  id: string;
  slug?: string;
  title: string;
  author: string;
  series?: string;
  seriesNumber?: number;
  isbn: string;
  coverUrl: string;
  format: 'Ebook' | 'Physical' | 'Audiobook';
  totalPages: number;
  currentPage: number;
  status: 'Reading' | 'Finished' | 'DNF' | 'To Read';
  rating?: number;
  dateStarted?: string;
  dateFinished?: string;
  reviewUrl?: string;
  logs: DailyLog[];
}

const IS_NETLIFY = process.env.NETLIFY === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

// Reads backups from public/data/books during serverless cold start via fs or fetch
async function readServerlessBackups(): Promise<Book[]> {
  const allBooks: Book[] = [];
  try {
    // In Netlify functions, public assets are typically accessible relative to process.cwd() or site root
    const publicDir = path.resolve('./public/data/books');
    const files = await fs.readdir(publicDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const raw = await fs.readFile(path.join(publicDir, file), 'utf-8');
      const books = JSON.parse(raw) as Book[];
      if (Array.isArray(books)) {
        allBooks.push(...books);
      }
    }
  } catch (err) {
    console.warn('Could not read public JSON backups from disk:', (err as Error).message);
  }
  return allBooks;
}

export async function getAllBooks(): Promise<Book[]> {
  try {
    const store = getStore('books');
    
    // 1. Attempt to fetch the unified master catalog
    const masterCatalog = await store.get('master-catalog.json', { type: 'json' });
    if (masterCatalog && Array.isArray(masterCatalog)) {
      return masterCatalog as Book[];
    }

    // 2. Cold Start Bootstrap: Read from public/data/books/
    const initialBooks = await readServerlessBackups();
    console.log(`Cold start bootstrap: Found ${initialBooks.length} books in public/data/books/`);
    
    if (initialBooks.length > 0) {
      await store.setJSON('master-catalog.json', initialBooks);
    }
    return initialBooks;
  } catch (err) {
    console.warn('Blobs store unavailable:', (err as Error).message);
    return await readServerlessBackups();
  }
}

export async function getBook(id: string): Promise<Book | null> {
  const books = await getAllBooks();
  return books.find((b) => b.id === id) || null;
}

export async function saveBook(book: Book): Promise<void> {
  try {
    const store = getStore('books');
    const books = await getAllBooks();
    const index = books.findIndex((b) => b.id === book.id);
    
    if (index >= 0) {
      books[index] = book;
    } else {
      books.push(book);
    }

    await store.setJSON('master-catalog.json', books);
  } catch (err) {
    console.warn('Failed writing to Blobs master catalog:', (err as Error).message);
  }
}

export async function deleteBook(id: string): Promise<void> {
  try {
    const store = getStore('books');
    const books = await getAllBooks();
    const filteredBooks = books.filter((b) => b.id !== id);

    await store.setJSON('master-catalog.json', filteredBooks);
  } catch (err) {
    console.warn('Failed deleting from Blobs master catalog:', (err as Error).message);
  }
}
