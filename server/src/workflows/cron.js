// Expressões cron de 5 campos (minuto hora dia-do-mês mês dia-da-semana), com fuso horário IANA.

const RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];

function parseField(field, [min, max]) {
  const values = new Set();
  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart ? Number(stepPart) : 1;
    let start; let end;
    if (rangePart === '*') { start = min; end = max; }
    else if (rangePart.includes('-')) { [start, end] = rangePart.split('-').map(Number); }
    else { start = Number(rangePart); end = stepPart ? max : start; }
    if ([start, end, step].some((n) => !Number.isInteger(n)) || start < min || end > max || step < 1) {
      throw new Error(`Campo cron inválido: "${field}"`);
    }
    for (let v = start; v <= end; v += step) values.add(v);
  }
  return values;
}

export function parseCron(expression) {
  const fields = String(expression).trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Expressão cron inválida: "${expression}"`);
  const [minute, hour, dom, month, dow] = fields.map((f, i) => parseField(f, RANGES[i]));
  if (dow.has(7)) dow.add(0);
  return { minute, hour, dom, month, dow, domStar: fields[2] === '*', dowStar: fields[4] === '*' };
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function partsInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC', hour12: false, weekday: 'short',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { minute: Number(p.minute), hour: Number(p.hour) % 24, dom: Number(p.day), month: Number(p.month), dow: WEEKDAYS[p.weekday] };
}

/** Indica se a expressão corresponde ao minuto da data indicada. */
export function cronMatches(parsed, date, timeZone) {
  const t = partsInZone(date, timeZone);
  if (!parsed.minute.has(t.minute) || !parsed.hour.has(t.hour) || !parsed.month.has(t.month)) return false;
  // Semântica cron clássica: se ambos os campos de dia forem restritos, basta um coincidir.
  const domOk = parsed.dom.has(t.dom);
  const dowOk = parsed.dow.has(t.dow);
  if (!parsed.domStar && !parsed.dowStar) return domOk || dowOk;
  return domOk && dowOk;
}
