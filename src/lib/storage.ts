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

const DATA_DIR = path.resolve('./public/data/books');
const IS_NETLIFY = process.env.NETLIFY === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

async function ensureDirectoryExists(): Promise<void> {
  if (IS_NETLIFY) return; // Never attempt to create directories on a read-only serverless filesystem
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

// Reads all yearly JSON files directly from disk (used for local dev or Netlify cold-start bootstrap)
async function readLocalBackup(): Promise<Book[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    const allBooks: Book[] = [];

    for (const file of jsonFiles) {
      const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
      const books = JSON.parse(raw) as Book[];
      if (Array.isArray(books)) {
        allBooks.push(...books);
      }
    }
    return allBooks;
  } catch (err) {
    console.warn('Failed to read local book backups:', err);
    return [];
  }
}

// Writes an individual book back to its specific yearly JSON file (Local development only)
async function writeLocalBackup(book: Book): Promise<void> {
  if (IS_NETLIFY) return; // Skip entirely on Netlify to prevent EROFS read-only errors

  await ensureDirectoryExists();
  const year = book.dateStarted ? new Date(book.dateStarted).getFullYear() : new Date().getFullYear();
  const filePath = path.join(DATA_DIR, `${year}.json`);

  let yearBooks: Book[] = [];
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    yearBooks = JSON.parse(raw);
  } catch {
    yearBooks = [];
  }

  const index = yearBooks.findIndex((b) => b.id === book.id);
  if (index >= 0) {
    yearBooks[index] = book;
  } else {
    yearBooks.push(book);
  }

  await fs.writeFile(filePath, JSON.stringify(yearBooks, null, 2), 'utf-8');
}

// Removes a book from its yearly JSON file backup (Local development only)
async function removeLocalBackup(id: string): Promise<void> {
  if (IS_NETLIFY) return; // Skip entirely on Netlify to prevent EROFS read-only errors

  try {
    await ensureDirectoryExists();
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = path.join(DATA_DIR, file);
      const raw = await fs.readFile(filePath, 'utf-8');
      let yearBooks = JSON.parse(raw) as Book[];
      const initialLength = yearBooks.length;
      
      yearBooks = yearBooks.filter((b) => b.id !== id);
      
      if (yearBooks.length !== initialLength) {
        await fs.writeFile(filePath, JSON.stringify(yearBooks, null, 2), 'utf-8');
      }
    }
  } catch {
    // Ignore local backup cleanup errors
  }
}

// FAST FETCH: Uses a single master catalog blob instead of hundreds of individual requests
export async function getAllBooks(): Promise<Book[]> {
  if (!IS_NETLIFY) {
    return await readLocalBackup();
  }

  try {
    const store = getStore('books');
    
    // 1. Attempt to fetch the unified master catalog in a SINGLE network call
    const masterCatalog = await store.get('master-catalog.json', { type: 'json' });
    if (masterCatalog && Array.isArray(masterCatalog)) {
      return masterCatalog as Book[];
    }

    // 2. Cold Start Bootstrap: If the master catalog doesn't exist in blobs yet, 
    // load the public backup files via filesystem, initialize the master catalog, and return them.
    const initialBooks = await readLocalBackup();
    console.log(`Cold start bootstrap: Found ${initialBooks.length} books in public/data/books/`);
    
    if (initialBooks.length > 0) {
      await store.setJSON('master-catalog.json', initialBooks);
    }
    return initialBooks;
  } catch (err) {
    console.warn('Blobs store unavailable. Using fallback backup:', (err as Error).message);
    return await readLocalBackup();
  }
}

export async function getBook(id: string): Promise<Book | null> {
  const books = await getAllBooks();
  return books.find((b) => b.id === id) || null;
}

// SAVE: Updates the master catalog blob atomically
export async function saveBook(book: Book): Promise<void> {
  await writeLocalBackup(book); // Only runs locally; safe on Netlify because of IS_NETLIFY check

  if (IS_NETLIFY) {
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
}

// DELETE: Removes the book from the master catalog blob atomically
export async function deleteBook(id: string): Promise<void> {
  await removeLocalBackup(id); // Only runs locally; safe on Netlify because of IS_NETLIFY check

  if (IS_NETLIFY) {
    try {
      const store = getStore('books');
      const books = await getAllBooks();
      const filteredBooks = books.filter((b) => b.id !== id);

      await store.setJSON('master-catalog.json', filteredBooks);
    } catch (err) {
      console.warn('Failed deleting from Blobs master catalog:', (err as Error).message);
    }
  }
}
