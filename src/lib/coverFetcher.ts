// src/lib/coverFetcher.ts

const OL_HEADERS = {
  "User-Agent": "ReadingChallengeTracker/1.0 (personal self-hosted app)",
};

export async function fetchBestCover(book: { isbn?: string; title: string; author: string }): Promise<string> {
  const cleanIsbn = book.isbn ? book.isbn.trim() : '';
  
  // Strip out volume indicators, brackets, and extra junk so title searches actually match
  const rawTitle = book.title || '';
  const sanitizedTitle = rawTitle
    .replace(/v(ol(ume)?)?\.?\s*\d+/gi, '') // Removes Vol. 3, Volume 1, v.2
    .replace(/\[.*?\]|\(.*?\)/g, '')         // Removes brackets/parentheses like [Light Novel]
    .trim();

  const cleanTitle = sanitizedTitle || rawTitle.trim();
  const cleanAuthor = book.author ? book.author.trim() : '';

  // 1. Try RanobeDB first for Light Novels / Niche Media
  if (cleanTitle) {
    try {
      const query = encodeURIComponent(cleanTitle);
      const res = await fetchWithTimeout(`https://ranobedb.org/api/v0/books?search=${query}&limit=1`);
      if (res.ok) {
        const data = await res.json() as any;
        if (Array.isArray(data) && data.length > 0 && data[0].cover) {
          let coverUrl = data[0].cover;
          if (coverUrl.startsWith('/')) {
            coverUrl = `https://ranobedb.org${coverUrl}`;
          }
          return coverUrl;
        }
      }
    } catch (err) {
      console.error(`RanobeDB API error for "${book.title}":`, err);
    }
  }

  // 2. Try Hardcover API via GraphQL search
  if (cleanTitle) {
    try {
      const hardcoverCover = await tryHardcover(cleanIsbn, cleanTitle);
      if (hardcoverCover) return hardcoverCover;
    } catch (err) {
      console.error(`Hardcover API error for "${book.title}":`, err);
    }
  }

  // 3. Try Open Library using the cleaned title and author
  if (cleanTitle) {
    const olCover = await tryOpenLibrary(cleanTitle, cleanAuthor);
    if (olCover) return olCover;
  }

  // 4. Fallback to Goodreads Community API
  try {
    const grUrl = cleanIsbn 
      ? `https://bookcover.longitood.com/bookcover?isbn=${cleanIsbn}`
      : `https://bookcover.longitood.com/bookcover?book_title=${encodeURIComponent(cleanTitle)}&author_name=${encodeURIComponent(cleanAuthor)}`;
    
    const res = await fetchWithTimeout(grUrl);
    const data = await res.json() as any;
    if (res.ok && data && data.url) {
      return data.url;
    }
  } catch (err) {
    console.error(`Goodreads API error for "${book.title}":`, err);
  }

  // 5. Absolute Final Fallback: Return an empty string
  return '';
}

// Helper: Hardcover GraphQL API integration
async function tryHardcover(isbn: string, title: string): Promise<string | null> {
  try {
    const apiKey = process.env.HARDCOVER_API_TOKEN;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const graphqlQuery = `
      query SearchBooks($term: String!) {
        books(where: {title: {_eq: $term}}, limit: 1) {
          image {
            url
          }
        }
      }
    `;

    const response = await fetchWithTimeout('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { term: title }
      })
    });

    if (!response.ok) return null;

    const result = await response.json() as any;
    const imageUrl = result?.data?.books?.[0]?.image?.url;

    if (imageUrl && typeof imageUrl === 'string') {
      return imageUrl.replace('http://', 'https://');
    }
  } catch (e) {}
  return null;
}

// Helper: Open Library implementation with HEAD verification
async function tryOpenLibrary(title: string, author: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      title,
      author,
      limit: "3",
      fields: "title,author_name,cover_i",
    });

    const response = await fetchWithTimeout(`https://openlibrary.org/search.json?${params.toString()}`, {
      headers: OL_HEADERS,
    });
    if (!response.ok) return null;

    const data = await response.json() as any;
    for (const doc of data.docs || []) {
      if (!doc.cover_i) continue;

      const coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      
      const check = await fetchWithTimeout(`${coverUrl}?default=false`, {
        method: "HEAD",
        headers: OL_HEADERS,
        redirect: "follow",
      });

      if (check.ok) {
        return coverUrl;
      }
    }
  } catch (e) {}
  return null;
}

async function fetchWithTimeout(url: string, options = {}, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}
