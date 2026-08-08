// src/pages/api/log.ts
import type { APIRoute } from 'astro';
import { getBook, saveBook } from '../../lib/storage';
import { fetchBestCover } from '../../lib/coverFetcher';

export const prerender = false;

// Helper to ensure dates evaluate using local time instead of UTC roll-over
function getLocalToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      id,
      slug,
      title,
      author,
      series,
      isbn,
      pagesRead,
      currentPage,
      status,
      rating,
      reviewUrl,
      format,
      totalPages,
      dateStarted,
      coverUrl
    } = body;

    const today = getLocalToday();
    let book = id ? await getBook(id) : null;

    if (!book) {
      // Resolve cover: use custom override if given, otherwise run the smart fallback utility
      let resolvedCover = coverUrl ? coverUrl.trim() : '';
      if (!resolvedCover) {
        resolvedCover = await fetchBestCover({
          isbn: isbn || '',
          title: title || '',
          author: author || ''
        }) || '';
      }

      book = {
        id: id || crypto.randomUUID(),
        slug: slug || slugify(title || 'untitled'),
        title: title || '',
        author: author || '',
        series: series ? series.trim() : undefined,
        isbn: isbn || '',
        coverUrl: resolvedCover,
        format: format || 'Ebook',
        totalPages: Number(totalPages) || 0,
        currentPage: Number(currentPage) || 0,
        status: status || 'Reading',
        dateStarted: dateStarted || today,
        logs: []
      };
    }

    if (title) book.title = title;
    if (author) book.author = author;
    if (series !== undefined) {
      book.series = series.trim() !== '' ? series.trim() : undefined;
    }
    
    // Allow updating coverUrl if explicitly provided on subsequent requests
    if (coverUrl !== undefined && coverUrl.trim() !== '') {
      book.coverUrl = coverUrl.trim();
    }

    if (currentPage !== undefined) book.currentPage = Number(currentPage);
    if (status) book.status = status;
    if (rating !== undefined) book.rating = rating ? Number(rating) : undefined;
    if (reviewUrl !== undefined) book.reviewUrl = reviewUrl;
    if (status === 'Finished' && !book.dateFinished) book.dateFinished = today;

    if (pagesRead && Number(pagesRead) > 0) {
      const existingLog = book.logs.find((l) => l.date === today);
      if (existingLog) {
        existingLog.pagesRead += Number(pagesRead);
      } else {
        book.logs.push({ date: today, pagesRead: Number(pagesRead) });
      }
    }

    await saveBook(book);

    return new Response(JSON.stringify({ success: true, book }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
