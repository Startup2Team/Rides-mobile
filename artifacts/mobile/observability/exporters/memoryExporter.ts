export class MemoryExporter<T> {
  private items: T[] = [];

  export(item: T) {
    this.items = [...this.items, item];
  }

  getItems() {
    return [...this.items];
  }

  clear() {
    this.items = [];
  }
}
