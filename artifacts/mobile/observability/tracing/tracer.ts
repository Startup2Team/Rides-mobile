export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  correlationId: string;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  correlationId: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  attributes: Record<string, unknown>;
  status: 'running' | 'ok' | 'error';
}

export interface TracerOptions {
  idFactory?: () => string;
  now?: () => Date;
}

function defaultIdFactory() {
  return Math.random().toString(36).slice(2, 14);
}

export class Tracer {
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private spans: Span[] = [];

  constructor(options: TracerOptions = {}) {
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.now = options.now ?? (() => new Date());
  }

  startSpan(name: string, parent?: TraceContext | null, attributes: Record<string, unknown> = {}) {
    const traceId = parent?.traceId ?? this.idFactory();
    const span: Span = {
      traceId,
      spanId: this.idFactory(),
      parentSpanId: parent?.spanId ?? null,
      correlationId: parent?.correlationId ?? traceId,
      name,
      startedAt: this.now().toISOString(),
      endedAt: null,
      attributes,
      status: 'running',
    };
    this.spans = [...this.spans, span];
    return span;
  }

  childSpan(name: string, parent: TraceContext | Span, attributes: Record<string, unknown> = {}) {
    return this.startSpan(name, parent, attributes);
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok') {
    let ended: Span | null = null;
    this.spans = this.spans.map(span => {
      if (span.spanId !== spanId) return span;
      ended = { ...span, endedAt: this.now().toISOString(), status };
      return ended;
    });
    return ended;
  }

  contextFrom(span: Span): TraceContext {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      correlationId: span.correlationId,
    };
  }

  getSpans() {
    return [...this.spans];
  }

  clear() {
    this.spans = [];
  }
}
