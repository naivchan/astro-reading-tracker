# 📚 Astro Reading Tracker

A lightweight, self-hosted book tracking and reading history dashboard built with **Astro**, **Netlify Blobs**, and **Chart.js**. Designed for book lovers who want a clean, fast, and fully customizable alternative to commercial reading trackers.

---

## ✨ Features

* **📖 Bookshelf Management:** Organize your library into *Currently Reading*, *Finished*, and *DNF* (Did Not Finish) collections with dynamic filtering.
* **📊 Detailed Reading History & Stats:** Interactive daily pages read charts and a monthly reading calendar to visualize your reading habits.
* **⚡ Live Updates:** Uses a single-file catalog stored in Netlify Blobs for lightning-fast reads and instant updates across all pages when logging sessions.
* **⏱️ Session & Progress Logging:** Log pages read daily or update via direct current page numbers and percentages.
* **🔍 Automatic Cover Fetching:** Automatically pulls book covers via ISBN using Open Library and Google Books integration if a custom cover isn't provided.
* **🔒 Admin Protection:** Secure admin mode protected via environment variables to add logs, edit metadata, and manage books.
* **🔄 Automated Backups:** Scheduled background function that automatically commits and backs up your book catalog JSON to a GitHub repository.

---

## 🚀 Setup & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name

```

### 2. Install Dependencies

```bash
npm install

```

### 3. Configure Environment Variables

Create a `.env` file in the root of your project for local development (or configure them in your Netlify dashboard for production):

```env
ADMIN_PASSWORD=your_secure_admin_password_here
GITHUB_TOKEN=your_personal_access_token_here
GITHUB_REPO=your-username/your-backup-repo-name
GITHUB_BRANCH=main

```

---

## 🔑 GitHub Backup Configuration (`scheduled-backup.ts`)

To enable the automated backup function to push your reading catalog to GitHub, you need to configure a GitHub Personal Access Token (PAT) and the corresponding environment variables.

### Step 1: Generate a GitHub Personal Access Token (PAT)

1. Go to your GitHub account settings: **Settings > Developer settings > Personal access tokens**.
2. Choose **Fine-grained tokens** (recommended) or **Tokens (classic)**.
3. Grant the token permission to write/commit code to your target repository:
* **Classic Token Scopes:** Check `repo` (Full control of private repositories).
* **Fine-grained Token Permissions:** Select your backup repository under *Repository access*, and under *Repository permissions*, set **Contents** to **Read and write**.


4. Generate the token and copy it.

### Step 2: Add Environment Variables

Add the following variables in your local `.env` file and your Netlify Site Settings (**Site settings > Environment variables**):

* **`ADMIN_PASSWORD`**: The password required to unlock editing mode on your site.
* **`GITHUB_TOKEN`**: The Personal Access Token you generated in Step 1.
* **`GITHUB_REPO`**: The target repository formatted as `owner/repository-name` (e.g., `pomnavii/reading-backups`).
* **`GITHUB_BRANCH`**: The branch name where backups should be committed (e.g., `main`).

---

## 🚢 Deployment (Netlify)

1. Push your repository to GitHub.
2. Log in to [Netlify](https://www.netlify.com/) and click **Add new site** > **Import an existing project**.
3. Select your repository. Netlify will automatically detect Astro and pre-fill the build settings:
* **Build Command:** `npm run build`
* **Publish Directory:** `dist`


4. Go to **Site settings > Environment variables** and add all your required variables (`ADMIN_PASSWORD`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`).
5. Click **Deploy site**!

---
## 🔑 Demo & Test Credentials

You can test this project out at 

* **Demo Password:** `demoreadingtracker`

Make sure to change this to a secure, private password via your environment variables if you are setting up your own personal tracker!

