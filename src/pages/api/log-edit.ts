// src/pages/api/log-edit.ts
export const prerender = false;

import type { APIRoute } from 'astro';
import { getBook, saveBook } from '../../lib/storage';

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
    const { 
      bookId, 
      date, 
      pagesRead: directPages, 
      currentPage: targetCurrentPage, 
      percentage, 
      series, 
      delete: isDelete 
    } = await request.json();

    const book = await getBook(bookId);
    if (!book) return new Response(JSON.stringify({ error: 'Book not found' }), { status: 404 });

    if (!book.logs) book.logs = [];

    // Handle series update if provided in the payload
    if (series !== undefined) {
      book.series = series.trim() !== '' ? series.trim() : undefined;
    }

    if (isDelete) {
      book.logs = book.logs.filter((l) => l.date !== date);
      // Recalculate book.currentPage based on remaining logs
      book.currentPage = book.logs.reduce((sum, l) => sum + l.pagesRead, 0);
      await saveBook(book);

      return new Response(JSON.stringify({ success: true, book }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate actual pages read for this date entry
    let targetPagesRead = Number(directPages) || 0;

    // Filter out the current date's log if it already exists to calculate prior progress accurately
    const priorLogsTotal = book.logs
      .filter((l) => l.date !== date)
      .reduce((sum, l) => sum + l.pagesRead, 0);

    if (targetCurrentPage !== undefined && targetCurrentPage !== '') {
      targetPagesRead = Math.max(0, Number(targetCurrentPage) - priorLogsTotal);
    } else if (percentage !== undefined && percentage !== '') {
      if (!book.totalPages) {
        return new Response(JSON.stringify({ error: 'Total pages must be set on the book to use percentage logging.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const targetPageFromPct = Math.round((Number(percentage) / 100) * book.totalPages);
      targetPagesRead = Math.max(0, targetPageFromPct - priorLogsTotal);
    }

    // Upsert the log for this date
    const existingLogIndex = book.logs.findIndex((l) => l.date === date);
    if (existingLogIndex >= 0) {
      if (targetPagesRead <= 0) {
        book.logs.splice(existingLogIndex, 1);
      } else {
        book.logs[existingLogIndex].pagesRead = targetPagesRead;
      }
    } else if (targetPagesRead > 0) {
      book.logs.push({ date, pagesRead: targetPagesRead });
    }

    // Sync book's overall current page
    book.currentPage = book.logs.reduce((sum, l) => sum + l.pagesRead, 0);
    if (book.totalPages && book.currentPage >= book.totalPages) {
      book.status = 'Finished';
    }

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
