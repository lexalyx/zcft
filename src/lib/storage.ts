// Storage ném lỗi khi bị chặn (chế độ ẩn danh) hoặc hết dung lượng.

const PREFIX = "zcft:";
type Kind = "local" | "session";

function store(kind: Kind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function load<T>(key: string, fallback: T, kind: Kind = "local"): T {
  try {
    const raw = store(kind)?.getItem(PREFIX + key);
    return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown, kind: Kind = "local"): void {
  try {
    store(kind)?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
  }
}

export function remove(key: string, kind: Kind = "local"): void {
  try {
    store(kind)?.removeItem(PREFIX + key);
  } catch {
  }
}
