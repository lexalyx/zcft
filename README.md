# ZCFT – Legal argument practice

A web page where law students practise three-layer legal argument: national law, international treaties or standards, and a conciliation proposal. The student edits a case file, is challenged by an "opposing counsel" played by Gemini, writes an argument and gets it graded. The interface is in Vietnamese.

- Static site, no server. Everything runs in the browser.
- Each student uses their own free Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The key stays in the browser and is sent only to Google.
- Free-tier limits are per model. A lesson with five risk nodes costs six requests: one for all the questions, one per graded answer.
- The embedding model that finds relevant sources runs on the student's machine and is downloaded on first use (118 MB for the default).

**Privacy:** under the [Gemini API terms](https://ai.google.dev/gemini-api/terms), with a free key Google may use submitted content, including the student's answers, to improve its products, and Google staff may read it. API users must be 18 or older.

## Hướng dẫn sử dụng

Hướng dẫn từng bước có ảnh chụp màn hình: [public/huong-dan/huong-dan-su-dung.md](public/huong-dan/huong-dan-su-dung.md). Trang web hiển thị chính file này ở nút **Hướng dẫn** (cột trái); ảnh nằm cùng thư mục.

## Lessons

A lesson is an Excel file. Start from `public/mau_bai_hoc.xlsx`; its guide sheet explains each column.

- **For everyone:** put the file in `public/lessons/`. The file name is the lesson title. The lesson list is generated at build time.
- **For one browser only:** lessons and legal sources added through the page are stored in that browser. Nobody else sees them.

The reader accepts sheet and column names with or without Vietnamese diacritics, columns in any order, and risk written as `0,7`, `70%` or `70`.

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev        # http://localhost:5173
bun run check      # type check, must be 0 errors and 0 warnings
bun run test       # vitest, tests are in tests/
bun run build      # output in dist/, relative paths, works on any static host
bun run template   # regenerate public/mau_bai_hoc.xlsx
```

Build an Excel lesson from a JSON lesson (shape as in `src/lib/types.ts`):

```bash
bun scripts/make-template.ts "public/lessons/Lesson title.xlsx" lesson.json
```

Pushing to `main` or `master` runs `.github/workflows/pages.yml`, which checks, tests, builds and publishes to GitHub Pages. One-time setup: in the repository's **Settings > Pages**, set **Source** to **GitHub Actions**.

`app.py` is the original Streamlit prototype, kept as a reference for the flow. It is not part of the build.
