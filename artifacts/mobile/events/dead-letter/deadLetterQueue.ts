import type { DomainEvent, EventValidationIssue } from '../types';

export interface DeadLetterEntry {
  id: string;
  event: DomainEvent;
  reason: string;
  issues: EventValidationIssue[];
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface DeadLetterQueueOptions {
  idFactory?: () => string;
  now?: () => Date;
}

function defaultIdFactory() {
  return `dead_letter_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class DeadLetterQueue {
  private entries: DeadLetterEntry[] = [];
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(options: DeadLetterQueueOptions = {}) {
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.now = options.now ?? (() => new Date());
  }

  add(event: DomainEvent, reason: string, issues: EventValidationIssue[] = []) {
    const at = this.now().toISOString();
    const entry: DeadLetterEntry = {
      id: this.idFactory(),
      event,
      reason,
      issues,
      retryCount: 0,
      createdAt: at,
      updatedAt: at,
      archivedAt: null,
    };
    this.entries = [...this.entries, entry];
    return entry;
  }

  inspect(id?: string) {
    if (id) return this.entries.find(entry => entry.id === id) ?? null;
    return [...this.entries];
  }

  retry(id: string) {
    const at = this.now().toISOString();
    let nextEntry: DeadLetterEntry | null = null;
    this.entries = this.entries.map(entry => {
      if (entry.id !== id) return entry;
      nextEntry = { ...entry, retryCount: entry.retryCount + 1, updatedAt: at };
      return nextEntry;
    });
    return nextEntry;
  }

  archive(id: string) {
    const at = this.now().toISOString();
    let nextEntry: DeadLetterEntry | null = null;
    this.entries = this.entries.map(entry => {
      if (entry.id !== id) return entry;
      nextEntry = { ...entry, archivedAt: at, updatedAt: at };
      return nextEntry;
    });
    return nextEntry;
  }

  remove(id: string) {
    const entry = this.entries.find(item => item.id === id) ?? null;
    this.entries = this.entries.filter(item => item.id !== id);
    return entry;
  }

  clear() {
    this.entries = [];
  }

  size() {
    return this.entries.filter(entry => !entry.archivedAt).length;
  }
}
