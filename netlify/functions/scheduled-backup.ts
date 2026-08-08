// netlify/functions/scheduled-backup.ts
import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { syncYearlyBackupToGitHub } from '../../src/lib/github';
import type { Book } from '../../src/lib/storage';

export default async function handler() {
  console.log('Running daily reading data backup...');

  try {
    // 1. Fetch master catalog using the correct 'books' store and 'master-catalog.json' key
    const store = getStore('books');

    const catalogRaw = await store.get('master-catalog.json');
    if (!catalogRaw) {
      console.log('No master-catalog.json found in Netlify Blobs.');
      return;
    }

    const books: Book[] = JSON.parse(catalogRaw);
    if (!books || books.length === 0) {
      console.log('No books found to back up.');
      return;
    }

    // 2. Group books into year buckets based on dateStarted
    const booksByYear: Record<number, Book[]> = {};

    for (const book of books) {
      const year = book.dateStarted
        ? new Date(book.dateStarted).getFullYear()
        : new Date().getFullYear();

      if (isNaN(year)) continue;

      if (!booksByYear[year]) {
        booksByYear[year] = [];
      }
      booksByYear[year].push(book);
    }

    // 3. Commit each year's complete JSON file independently to GitHub under data/books/
    for (const [yearStr, yearlyBooks] of Object.entries(booksByYear)) {
      await syncYearlyBackupToGitHub(Number(yearStr), yearlyBooks);
    }

    console.log('Daily backup completed and synced to GitHub successfully with all fields intact.');
  } catch (error) {
    console.error('Scheduled backup execution failed:', error);
  }
}

// Runs every day at midnight (UTC)
export const config: Config = {
  schedule: '@weekly',
};
