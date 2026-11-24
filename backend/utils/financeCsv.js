const { parse } = require('csv-parse/sync');

const CURRENCIES = new Set(['BDT', 'USD', 'EUR', 'GBP', 'INR']);
const REQUIRED_HEADERS = ['type', 'date', 'category', 'amount'];
const ALLOWED_HEADERS = new Set([...REQUIRED_HEADERS, 'currency', 'description']);
const MAX_CSV_BYTES = 1024 * 1024;
const MAX_CSV_ROWS = 500;

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateCsvRecord(record, defaultCurrency, rowNumber) {
  const row = { ...record };
  row.type = String(row.type || '').trim().toLowerCase();
  row.date = String(row.date || '').trim();
  row.category = String(row.category || '').trim();
  row.description = String(row.description || '').trim();
  row.currency = String(row.currency || defaultCurrency || 'BDT').trim().toUpperCase();
  row.amount = Number(row.amount);

  const errors = [];
  if (!['expense', 'income'].includes(row.type)) errors.push('type must be expense or income');
  if (!isValidDate(row.date)) errors.push('date must be a real YYYY-MM-DD date');
  if (!row.category || row.category.length > 50) errors.push('category must contain 1 to 50 characters');
  if (!Number.isFinite(row.amount) || row.amount < 0.01 || row.amount > 1000000000) errors.push('amount must be between 0.01 and 1,000,000,000');
  if (!CURRENCIES.has(row.currency)) errors.push('currency must be BDT, USD, EUR, GBP, or INR');
  if (row.description.length > 500) errors.push('description must be 500 characters or fewer');
  if (errors.length) return { error: `Row ${rowNumber}: ${errors.join('; ')}` };

  return { value: {
    type: row.type,
    date: row.date,
    category: row.category,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
  } };
}

function parseFinanceCsv(csv, defaultCurrency) {
  if (typeof csv !== 'string' || Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) {
    return { error: 'CSV must be text smaller than 1 MB.' };
  }

  let records;
  try {
    records = parse(csv, {
      bom: true,
      columns: (headers) => headers.map((header) => header.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      max_record_size: 6000,
    });
  } catch (error) {
    return { error: `Could not read CSV: ${error.message}` };
  }
  if (!records.length) return { error: 'CSV has no transaction rows.' };
  const headers = Object.keys(records[0]);
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  const unsupported = headers.filter((header) => !ALLOWED_HEADERS.has(header));
  if (missing.length) return { error: `CSV is missing required columns: ${missing.join(', ')}.` };
  if (unsupported.length) return { error: `CSV has unsupported columns: ${unsupported.join(', ')}.` };
  if (records.length > MAX_CSV_ROWS) return { error: `CSV can contain at most ${MAX_CSV_ROWS} transactions at a time.` };

  const rows = [];
  for (let index = 0; index < records.length; index += 1) {
    const result = validateCsvRecord(records[index], defaultCurrency, index + 2);
    if (result.error) return { error: result.error };
    rows.push(result.value);
  }
  return { rows };
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function serializeFinanceCsv(rows) {
  const headers = ['type', 'date', 'category', 'amount', 'currency', 'description'];
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\r\n');
}

function serializeReportCsv(rows) {
  const headers = ['month', 'type', 'currency', 'category', 'total', 'budget'];
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))].join('\r\n');
}

module.exports = { MAX_CSV_ROWS, parseFinanceCsv, serializeFinanceCsv, serializeReportCsv };
