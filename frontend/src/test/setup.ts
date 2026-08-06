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

vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
vi.stubGlobal("scrollTo", vi.fn());
