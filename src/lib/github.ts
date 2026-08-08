// src/lib/github.ts

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
  logs: { date: string; pagesRead: number; }[];
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_OWNER;
const REPO_NAME = process.env.GITHUB_REPO;

export async function syncYearlyBackupToGitHub(year: number, books: Book[]): Promise<void> {
  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    console.warn('GitHub environment variables missing. Skipping GitHub sync.');
    return;
  }

  const filePath = `src/data/books/${year}.json`;
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;

  try {
    let sha: string | undefined;
    const getFileRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (getFileRes.ok) {
      const fileData = await getFileRes.json();
      sha = fileData.sha;
    }

    const content = Buffer.from(JSON.stringify(books, null, 2)).toString('base64');

    const updateRes = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `chore: scheduled backup for ${year} reading data [skip ci]`,
        content,
        sha,
      }),
    });

    if (updateRes.ok) {
      console.log(`Successfully synced ${books.length} books to ${filePath}`);
    } else {
      console.error(`Failed committing ${filePath}:`, await updateRes.text());
    }
  } catch (error) {
    console.error(`Error syncing ${filePath} to GitHub:`, error);
  }
}
