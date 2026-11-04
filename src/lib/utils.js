// Small, dependency-free helpers used across the app.

// Join class names, skipping falsy values (tiny replacement for `clsx`).
export const cx = (...parts) => parts.filter(Boolean).join(' ');

// Client-generated unique IDs. These are the "temporary local IDs" of the sync design:
// every record is born on the device with a UUID, which doubles as the idempotency
// key the backend uses to detect duplicates. The server later returns its own `serverId`.
export function uid(prefix = '') {
  const raw =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
  return prefix + raw;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Error with a stable `code`, so the UI can translate it (errors.<code>) instead of
// showing raw English messages to an Arabic/Dari/Pashto speaker.
export class AppError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

// Two-letter initials for avatars; works for Latin and Arabic-script names.
export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0])[0] || '';
  const second = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] : '';
  return (first + second).toUpperCase();
}

// Stable hue-based pastel for avatars so each customer keeps the same color.
const AVATAR_TONES = [
  'bg-brand-100 text-brand-800',
  'bg-accent-100 text-accent-700',
  'bg-mint-100 text-mint-700',
  'bg-info-100 text-info-600',
  'bg-ink-100 text-ink-700',
];
export function avatarTone(seed = '') {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

// Download a text file in the browser (used for CSV exports).
export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  // BOM makes Excel open UTF-8 (Arabic/Persian) CSVs correctly.
  const blob = new Blob(['﻿', text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function toCsv(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

// Case/diacritic-insensitive search normalizer that also unifies Arabic/Persian
// letter variants (ي/ی, ك/ک) and digits, so "محمد" matches however it was typed.
export function normalizeSearch(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[̀-ͯ]/g, '');
}
