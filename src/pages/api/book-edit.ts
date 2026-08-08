// src/pages/api/book-edit.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { getBook, saveBook, deleteBook } from '../../lib/storage';
import { fetchBestCover } from '../../lib/coverFetcher';

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
    const body = await request.json();

    // Handle full book deletion
    if (body.deleteBook && body.id) {
      await deleteBook(body.id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { 
      id, 
      title, 
      author, 
      series, 
      seriesNumber, 
      format, 
      status, 
      currentPage, 
      totalPages, 
      dateStarted, 
      dateFinished, 
      rating, 
      isbn, 
      coverUrl, 
      reviewUrl 
    } = body;

    const book = await getBook(id);
    if (!book) return new Response('Book not found', { status: 404 });

    book.title = title;
    book.author = author;
    
    // Handle series update
    if (series !== undefined && series.trim() !== '') {
      book.series = series.trim();
      book.seriesNumber = seriesNumber !== undefined && seriesNumber !== null && seriesNumber !== '' ? Number(seriesNumber) : undefined;
    } else {
      delete book.series;
      delete book.seriesNumber;
    }

    // Handle format and status
    if (format) book.format = format;
    if (status) book.status = status;

    // Handle numerical fields
    if (currentPage !== undefined && currentPage !== '') {
      book.currentPage = Number(currentPage);
    }
    if (totalPages !== undefined && totalPages !== '') {
      book.totalPages = Number(totalPages);
    }

    // Handle date fields
    if (dateStarted !== undefined) {
      if (dateStarted.trim() !== '') {
        book.dateStarted = dateStarted.trim();
      } else {
        delete book.dateStarted;
      }
    }

    if (dateFinished !== undefined) {
      if (dateFinished.trim() !== '') {
        book.dateFinished = dateFinished.trim();
      } else {
        delete book.dateFinished;
      }
    }

    // Handle rating
    if (rating !== undefined && rating !== '' && rating !== null) {
      book.rating = Number(rating);
    } else {
      delete book.rating;
    }

    // Handle ISBN
    if (isbn !== undefined) {
      book.isbn = isbn.trim();
    }

    // Handle Cover URL: If explicit coverUrl provided, use it. 
    // If it's blank/empty, automatically try to fetch the best cover using Open Library / Google Books.
    if (coverUrl && coverUrl.trim() !== '') {
      book.coverUrl = coverUrl.trim();
    } else {
      const discoveredCover = await fetchBestCover({
        isbn: book.isbn || '',
        title: book.title || '',
        author: book.author || ''
      });
      book.coverUrl = discoveredCover || '';
    }

    book.reviewUrl = reviewUrl;

    await saveBook(book);

    return new Response(JSON.stringify({ success: true, book }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
