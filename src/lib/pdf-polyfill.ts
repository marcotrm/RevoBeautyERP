// Polyfill di Promise.withResolvers per far funzionare pdfjs (dentro pdf-parse)
// anche su versioni di Node < 22 (es. l'ambiente di Railway).
if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== 'function') {
  (Promise as unknown as { withResolvers: unknown }).withResolvers = function <T>() {
    let resolve!: (v: T | PromiseLike<T>) => void;
    let reject!: (r?: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

export {};
