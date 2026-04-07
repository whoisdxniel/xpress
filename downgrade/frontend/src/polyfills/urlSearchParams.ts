type SearchParamPair = [string, string];

function decodeValue(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, "%20"));
}

function encodeValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function buildPairs(init?: unknown): SearchParamPair[] {
  if (!init) return [];

  if (typeof init === "string") {
    const raw = init.startsWith("?") ? init.slice(1) : init;
    if (!raw) return [];

    return raw
      .split("&")
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");
        if (separatorIndex < 0) return [decodeValue(entry), ""];
        return [decodeValue(entry.slice(0, separatorIndex)), decodeValue(entry.slice(separatorIndex + 1))];
      });
  }

  if (Array.isArray(init)) {
    return init
      .filter((pair): pair is [unknown, unknown] => Array.isArray(pair) && pair.length >= 2)
      .map(([key, value]) => [String(key), String(value)]);
  }

  if (typeof (init as any)?.forEach === "function" && typeof (init as any)?.entries === "function") {
    return Array.from((init as any).entries() as Iterable<[unknown, unknown]>).map(([key, value]) => [String(key), String(value)]);
  }

  if (typeof init === "object") {
    return Object.entries(init as Record<string, unknown>).flatMap(([key, value]) => {
      if (value == null) return [];
      if (Array.isArray(value)) return value.map((item) => [key, String(item)] as SearchParamPair);
      return [[key, String(value)] as SearchParamPair];
    });
  }

  return [];
}

class URLSearchParamsPolyfill {
  private pairs: SearchParamPair[];

  constructor(init?: unknown) {
    this.pairs = buildPairs(init);
  }

  append(name: string, value: string) {
    this.pairs.push([String(name), String(value)]);
  }

  delete(name: string) {
    const key = String(name);
    this.pairs = this.pairs.filter(([entryName]) => entryName !== key);
  }

  entries(): IterableIterator<SearchParamPair> {
    return this.pairs[Symbol.iterator]();
  }

  forEach(callback: (value: string, name: string, parent: URLSearchParamsPolyfill) => void, thisArg?: unknown) {
    for (const [name, value] of this.pairs) {
      callback.call(thisArg, value, name, this);
    }
  }

  get(name: string): string | null {
    const key = String(name);
    const found = this.pairs.find(([entryName]) => entryName === key);
    return found ? found[1] : null;
  }

  getAll(name: string): string[] {
    const key = String(name);
    return this.pairs.filter(([entryName]) => entryName === key).map(([, value]) => value);
  }

  has(name: string): boolean {
    const key = String(name);
    return this.pairs.some(([entryName]) => entryName === key);
  }

  keys(): IterableIterator<string> {
    return this.pairs.map(([name]) => name)[Symbol.iterator]();
  }

  set(name: string, value: string) {
    const key = String(name);
    const nextValue = String(value);
    let replaced = false;
    const nextPairs: SearchParamPair[] = [];

    for (const [entryName, entryValue] of this.pairs) {
      if (entryName !== key) {
        nextPairs.push([entryName, entryValue]);
        continue;
      }

      if (!replaced) {
        nextPairs.push([key, nextValue]);
        replaced = true;
      }
    }

    if (!replaced) nextPairs.push([key, nextValue]);
    this.pairs = nextPairs;
  }

  toString(): string {
    return this.pairs.map(([name, value]) => `${encodeValue(name)}=${encodeValue(value)}`).join("&");
  }

  values(): IterableIterator<string> {
    return this.pairs.map(([, value]) => value)[Symbol.iterator]();
  }

  [Symbol.iterator](): IterableIterator<SearchParamPair> {
    return this.entries();
  }
}

function needsURLSearchParamsPolyfill(): boolean {
  const globalScope = globalThis as any;
  const Current = globalScope.URLSearchParams;
  if (typeof Current !== "function") return true;

  try {
    const params = new Current();
    if (typeof params?.set !== "function") return true;
    params.set("a", "1");
    params.append("b", "2");
    return params.toString() !== "a=1&b=2";
  } catch {
    return true;
  }
}

if (needsURLSearchParamsPolyfill()) {
  (globalThis as any).URLSearchParams = URLSearchParamsPolyfill;
}