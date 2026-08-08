// src/pages/api/run-cover-cleanup.ts
import type { APIRoute } from 'astro';
import { getAllBooks, saveBook } from '../../lib/storage';
import { fetchBestCover } from '../../lib/coverFetcher';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('X-Admin-Password');
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (expectedPassword && authHeader !== expectedPassword) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const books = await getAllBooks();
    
    // Target books with empty covers or existing placeholder images that haven't been successfully checked yet
    const targetBook = books.find((book) => {
      const isMissing = !book.coverUrl || book.coverUrl.trim() === '';
      const isPlaceholder = book.coverUrl?.includes('placehold.co');
      const isMarkedChecked = book.coverUrl?.includes('checked=true');

      // We want to process these books if they match our target criteria and aren't marked with checked=true
      return (isMissing || isPlaceholder) && !isMarkedChecked;
    });

    if (!targetBook) {
      return new Response(
        JSON.stringify({ success: true, updated: false, remaining: 0, message: 'All book covers have been checked and processed!' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let updated = false;
    
    // Temporarily clear the coverUrl so fetchBestCover runs a fresh check
    targetBook.coverUrl = '';
    const newCover = await fetchBestCover(targetBook);
    
    if (newCover && newCover.trim() !== '') {
      targetBook.coverUrl = newCover;
      updated = true;
    } else {
      // If still not found anywhere, leave it completely blank and mark with checked=true to stop loops
      targetBook.coverUrl = 'checked=true';
      updated = true;
    }

    await saveBook(targetBook);

    // Count remaining targets based on the exact same logic
    const remainingBooks = books.filter((book) => {
      const isMissing = !book.coverUrl || book.coverUrl.trim() === '';
      const isPlaceholder = book.coverUrl?.includes('placehold.co');
      const isMarkedChecked = book.coverUrl?.includes('checked=true');
      return (isMissing || isPlaceholder) && !isMarkedChecked;
    }).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated, 
        title: targetBook.title,
        remaining: remainingBooks,
        message: `Checked "${targetBook.title}". ${remainingBooks} books remaining.` 
      }), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
