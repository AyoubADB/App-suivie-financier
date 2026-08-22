import type { DateRange, PeriodKind, RecurringFrequency } from '../types';

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Lundi comme premier jour de semaine. */
export function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  const res = startOfDay(d);
  res.setDate(res.getDate() - day);
  return res;
}

export function getRange(period: PeriodKind, ref: Date, custom?: DateRange | null): DateRange {
  const r = startOfDay(ref);
  switch (period) {
    case 'day':
      return { from: r, to: endOfDay(r) };
    case 'week': {
      const from = startOfWeek(r);
      const to = new Date(from);
      to.setDate(to.getDate() + 6);
      return { from, to: endOfDay(to) };
    }
    case 'month': {
      const from = new Date(r.getFullYear(), r.getMonth(), 1);
      const to = new Date(r.getFullYear(), r.getMonth() + 1, 0);
      return { from, to: endOfDay(to) };
    }
    case 'quarter': {
      const q = Math.floor(r.getMonth() / 3);
      const from = new Date(r.getFullYear(), q * 3, 1);
      const to = new Date(r.getFullYear(), q * 3 + 3, 0);
      return { from, to: endOfDay(to) };
    }
    case 'year': {
      return {
        from: new Date(r.getFullYear(), 0, 1),
        to: endOfDay(new Date(r.getFullYear(), 11, 31)),
      };
    }
    case 'custom': {
      if (custom) return { from: startOfDay(custom.from), to: endOfDay(custom.to) };
      return getRange('month', ref);
    }
  }
}

/** Période précédente de même durée (mois précédent pour "month", etc.). */
export function previousRange(period: PeriodKind, range: DateRange): DateRange {
  const from = new Date(range.from);
  const to = new Date(range.to);
  switch (period) {
    case 'day': {
      from.setDate(from.getDate() - 1);
      return { from, to: endOfDay(from) };
    }
    case 'week': {
      from.setDate(from.getDate() - 7);
      const end = new Date(from);
      end.setDate(end.getDate() + 6);
      return { from, to: endOfDay(end) };
    }
    case 'month': {
      const f = new Date(from.getFullYear(), from.getMonth() - 1, 1);
      return { from: f, to: endOfDay(new Date(from.getFullYear(), from.getMonth(), 0)) };
    }
    case 'quarter': {
      const f = new Date(from.getFullYear(), from.getMonth() - 3, 1);
      return { from: f, to: endOfDay(new Date(from.getFullYear(), from.getMonth(), 0)) };
    }
    case 'year': {
      const y = from.getFullYear() - 1;
      return { from: new Date(y, 0, 1), to: endOfDay(new Date(y, 11, 31)) };
    }
    case 'custom': {
      const durMs = to.getTime() - from.getTime();
      const prevTo = new Date(from.getTime() - 1);
      const prevFrom = new Date(prevTo.getTime() - durMs);
      return { from: startOfDay(prevFrom), to: endOfDay(prevTo) };
    }
  }
}

export function rangeDays(range: DateRange): number {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000));
}

export type Bucket = 'day' | 'week' | 'month';

/** Granularité des séries temporelles selon la durée de la période. */
export function bucketFor(range: DateRange): Bucket {
  const days = rangeDays(range);
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

export function bucketStart(d: Date, bucket: Bucket): Date {
  switch (bucket) {
    case 'day':
      return startOfDay(d);
    case 'week':
      return startOfWeek(d);
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1);
  }
}

export function nextBucket(d: Date, bucket: Bucket): Date {
  const res = new Date(d);
  if (bucket === 'day') res.setDate(res.getDate() + 1);
  else if (bucket === 'week') res.setDate(res.getDate() + 7);
  else res.setMonth(res.getMonth() + 1);
  return res;
}

export function bucketLabel(d: Date, bucket: Bucket): string {
  if (bucket === 'day') return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  if (bucket === 'week') return `sem. ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

export function addFrequency(d: Date, freq: RecurringFrequency): Date {
  const res = new Date(d);
  switch (freq) {
    case 'weekly':
      res.setDate(res.getDate() + 7);
      break;
    case 'monthly':
      res.setMonth(res.getMonth() + 1);
      break;
    case 'quarterly':
      res.setMonth(res.getMonth() + 3);
      break;
    case 'yearly':
      res.setFullYear(res.getFullYear() + 1);
      break;
  }
  return res;
}

/** Prochaine échéance strictement future à partir de la date de la transaction. */
export function computeNextDueDate(dateISO: string, freq: RecurringFrequency, now = new Date()): string {
  let next = fromISODate(dateISO);
  const today = startOfDay(now);
  let guard = 0;
  while (next < today && guard < 600) {
    next = addFrequency(next, freq);
    guard++;
  }
  return toISODate(next);
}

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Hebdo',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
};

export const PERIOD_LABELS: Record<Exclude<PeriodKind, 'custom'>, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  quarter: 'Trimestre',
  year: 'Année',
};

export function formatRangeLabel(range: DateRange): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const from = range.from.toLocaleDateString('fr-FR', opts);
  const to = range.to.toLocaleDateString('fr-FR', opts);
  return from === to ? from : `${from} → ${to}`;
}

/** Date de référence décalée de `offset` périodes (négatif = passé). */
export function shiftReference(period: PeriodKind, offset: number, now = new Date()): Date {
  const d = startOfDay(now);
  if (offset === 0) return d;
  switch (period) {
    case 'day':
      d.setDate(d.getDate() + offset);
      return d;
    case 'week':
      d.setDate(d.getDate() + offset * 7);
      return d;
    case 'month':
      return new Date(d.getFullYear(), d.getMonth() + offset, 1);
    case 'quarter':
      return new Date(d.getFullYear(), d.getMonth() + offset * 3, 1);
    case 'year':
      return new Date(d.getFullYear() + offset, 0, 1);
    case 'custom':
      return d;
  }
}

/** Libellé court et lisible de la période courante (ex. « Mars 2026 », « T1 2026 »). */
export function formatPeriodTitle(period: PeriodKind, range: DateRange): string {
  switch (period) {
    case 'day':
      return range.from.toLocaleDateString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });
    case 'week': {
      const to = new Date(range.to);
      return `${range.from.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
    }
    case 'month':
      return cap(range.from.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
    case 'quarter': {
      // Le numéro seul prête à confusion : on rappelle les mois couverts.
      const first = range.from.toLocaleDateString('fr-FR', { month: 'short' });
      const last = range.to.toLocaleDateString('fr-FR', { month: 'short' });
      return `T${Math.floor(range.from.getMonth() / 3) + 1} ${range.from.getFullYear()} · ${first} → ${last}`;
    }
    case 'year':
      return `${range.from.getFullYear()}`;
    case 'custom':
      return formatRangeLabel(range);
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
