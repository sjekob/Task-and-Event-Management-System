/** Loose JSON object as returned by the API. */
export type Json = Record<string, any>;

/** Helpers that read API JSON defensively (missing / wrong-typed fields). */
export class JsonReader {
  static str(v: unknown, fallback = ''): string {
    return v === null || v === undefined ? fallback : String(v);
  }

  static optStr(v: unknown): string | null {
    return v === null || v === undefined ? null : String(v);
  }

  static num(v: unknown, fallback = 0): number {
    const n = typeof v === 'number' ? v : Number(v);
    return v === null || v === undefined || Number.isNaN(n) ? fallback : n;
  }

  static optNum(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  /** Accepts true / 1 (SQLite booleans). */
  static bool(v: unknown): boolean {
    return v === true || v === 1 || v === '1';
  }

  static strList(v: unknown): string[] {
    return Array.isArray(v) ? v.map((e) => String(e)) : [];
  }

  static list<T>(v: unknown, parse: (j: Json) => T): T[] {
    if (!Array.isArray(v)) return [];
    const out: T[] = [];
    for (const e of v) {
      try {
        if (e && typeof e === 'object') out.push(parse(e as Json));
      } catch {
        /* skip a malformed row rather than failing the whole list */
      }
    }
    return out;
  }

  static obj(v: unknown): Json | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
  }
}

/** One page of a paginated list endpoint ({items, total, offset, has_more}). */
export class PageResult<T> {
  constructor(
    readonly items: T[],
    readonly total: number,
    readonly offset: number,
    readonly hasMore: boolean,
  ) {}

  static fromJson<T>(json: Json, parse: (j: Json) => T): PageResult<T> {
    return new PageResult<T>(
      JsonReader.list(json.items, parse),
      JsonReader.num(json.total),
      JsonReader.num(json.offset),
      json.has_more === true,
    );
  }
}
