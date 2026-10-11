import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const LESSONS_DIR = resolve(import.meta.dirname, "public/lessons");

function lessonIndexJson(): string {
  const lessons = readdirSync(LESSONS_DIR)
    .filter((name) => name.toLowerCase().endsWith(".xlsx") && !name.startsWith("~$") && !name.startsWith("."))
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((file) => ({ file, title: file.replace(/\.xlsx$/i, "").normalize("NFC") }));
  return JSON.stringify({ lessons }, null, 2);
}

function lessonIndex(): Plugin {
  return {
    name: "zcft-lesson-index",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0].endsWith("/lessons/index.json")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(lessonIndexJson());
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "lessons/index.json", source: lessonIndexJson() });
    },
  };
}

export default defineConfig({
  // Đường dẫn tương đối để chạy được ở https://<tài-khoản>.github.io/<tên-kho>/ mà không cần biết tên kho
  base: "./",
  plugins: [svelte(), lessonIndex()],
  build: {
    // ExcelJS (~930 KB) đã được tách thành file riêng và chỉ tải khi mở bài học, nên chấp nhận kích thước này
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
