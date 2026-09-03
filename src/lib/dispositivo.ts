/**
 * Da che dispositivo, in parole.
 *
 * L'user agent per esteso non lo legge nessuno: quello che serve sapere,
 * guardando un registro accessi o un consenso firmato, e' se era un telefono
 * o il computer del banco.
 */
export function descriviDispositivo(ua?: string | null): string | null {
  const s = String(ua || '');
  if (!s) return null;
  const sistema = /iPad/i.test(s) ? 'iPad'
    : /iPhone/i.test(s) ? 'iPhone'
      : /Android/i.test(s) ? 'Android'
        : /Macintosh|Mac OS/i.test(s) ? 'Mac'
          : /Windows/i.test(s) ? 'Windows'
            : /Linux/i.test(s) ? 'Linux' : 'sconosciuto';
  const browser = /Edg\//i.test(s) ? 'Edge'
    : /OPR\//i.test(s) ? 'Opera'
      : /Chrome\//i.test(s) ? 'Chrome'
        : /Safari\//i.test(s) ? 'Safari'
          : /Firefox\//i.test(s) ? 'Firefox' : '';
  return browser ? `${sistema} · ${browser}` : sistema;
}
