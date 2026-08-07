import "@testing-library/jest-dom/vitest";

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
}

/**
 * Node's experimental `localStorage` global shadows jsdom's and has no methods,
 * so browser code that persists a preference needs a real one here.
 */
class LocalStorageStub implements Storage {
  #entries = new Map<string, string>();
  get length() {
    return this.#entries.size;
  }
  clear() {
    this.#entries.clear();
  }
  getItem(key: string) {
    return this.#entries.get(key) ?? null;
  }
  key(index: number) {
    return [...this.#entries.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.#entries.delete(key);
  }
  setItem(key: string, value: string) {
    this.#entries.set(key, String(value));
  }
}

vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
vi.stubGlobal("scrollTo", vi.fn());
vi.stubGlobal("localStorage", new LocalStorageStub());
