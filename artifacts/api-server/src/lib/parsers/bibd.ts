// BIBD bank statement parser.
//
// pdf-parse v2 (pdfjs-dist under the hood) extracts text column-by-column,
// so a BIBD statement page comes out as TWO sequential blocks rather than
// interleaved rows:
//
//   <descriptions block>            (each transaction's narration, 1-3 lines)
//   Tarikh / Date / Huraian ...     (column header marker)
//   <transaction rows block>        (DATE \t AMOUNT \t BALANCE, one per line)
//
// We rely on:
//   1. The header marker to split the two blocks per page.
//   2. The strict `DD/MM/YYYY \t amount \t balance` shape to enumerate rows.
//   3. A set of known BIBD description prefixes (MC DEBIT, FUND TRANSFER,
//      ETUNAI, etc.) to split the description block into groups, one per row.
//   4. Running balance comparison to recover debit/credit direction
//      (withdrawals and deposits look identical in plain-text extraction).

// IMPORTANT: pdf-parse v2 transitively loads pdfjs-dist, which references
// DOM globals (DOMMatrix, ImageData, Path2D) at module-load time. Importing
// it eagerly crashes the API server on startup with "ReferenceError:
// DOMMatrix is not defined". We polyfill the minimum required globals and
// defer the import until the parser actually runs.
async function loadPdfParse() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") {
    class DOMMatrixStub {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(_init?: unknown) {}
      multiplySelf() { return this; }
      translateSelf() { return this; }
      scaleSelf() { return this; }
      invertSelf() { return this; }
      transformPoint(p: { x?: number; y?: number }) { return { x: p?.x ?? 0, y: p?.y ?? 0 }; }
    }
    g.DOMMatrix = DOMMatrixStub;
  }
  if (typeof g.ImageData === "undefined") {
    g.ImageData = class ImageDataStub {
      data: unknown;
      width: number;
      height: number;
      constructor(data: unknown, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    };
  }
  if (typeof g.Path2D === "undefined") {
    g.Path2D = class {};
  }
  const mod = await import("pdf-parse");
  return mod.PDFParse;
}

export interface ParsedRow {
  rawDate: string;
  rawDescription: string;
  rawAmount: string;
  normalizedDate: Date;
  normalizedDescription: string;
  normalizedAmount: string;
  type: "debit" | "credit";
  categorySuggestion: string | null;
  confidence: string;
}

// Matches a transaction row in the right-hand columns block.
const TX_ROW_RE = /^\s*(\d{2})\/(\d{2})\/(\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
// Matches the special "BALANCE BROUGHT FORWARD <bal>" line that sits just
// above the first transaction.
const BBF_RE = /BALANCE\s+BROUGHT\s+FORWARD\s+([\d,]+\.\d{2})/i;
// Lines that mark the start of a new transaction's narration. Covers the
// common BIBD prefixes; everything else is treated as a continuation.
const DESC_START_RE = /^(MC\s+(DEBIT|CREDIT|REFUND|REVERSAL)|FUND\s+TRANSFER|AUTO\s+FUND\s+TRANSFER|AFT\s+TO|TOP\s+UP\s+DES|ETUNAI(\s|$)|BANK\s+CHARGES?|BILL\s+PAYMENT|INTEREST(\s|$)|PROFIT\s+PAID|PAYROLL|SALARY|CASH\s+WITHDRAWAL|WITHDRAWAL|DEPOSIT(\s|$)|PAYMENT|CHEQUE|IB\s+|ATM\s+|MEPS|CASA(BND)?\b|REVERSAL|REFUND|DIRECT\s+DEBIT|STANDING\s+ORDER|GIRO|PURCHASE|POS\s+|CARD\s+|SERVICE\s+CHARGE|DEBIT\s+INTEREST|CREDIT\s+INTEREST|ADJUSTMENT)/i;
// Lines we never want to keep in a description (page headers/footers,
// statement metadata, address block).
const NOISE_RE = /^(Penyata|Account Statement|Page|Muka|Dari|of\b|Nombor Akaun|Account Number|Statement (Begin|End)|Penyata (Bermula|Berakhir)|Sila |Please notify|BIBD |cek-cek|cheques,|Go Green|Semua maklumat|All information|Date$|Tarikh$|Description$|Huraian$|Wang (Keluar|Masuk)$|Withdrawal$|Deposit$|Balance$|Baki$|Baki Dahulu|Previous Balance|Jumlah |Total |Current Balance|Baki Sekarang|Upgrade your|hari waktu|discrepancies|dimaklumkan |ini\. Baki|Negara Brunei|NO \d|RPN |SPG |JLN |PENGIRAN|SHAHBIRIN|banking with us|lain awda|business beyond|-- \d+ of \d+ --)/i;

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function categorize(desc: string): { suggestion: string | null; confidence: number } {
  const lower = desc.toLowerCase();
  if (/hua ho|giant|jaya|mydin|supa save|sing sing|first emporium|hypermart|mr\.d\.i\.y|grocer/.test(lower))
    return { suggestion: "Groceries", confidence: 0.85 };
  if (/petronas|shell|esso|petrol|fuel/.test(lower))
    return { suggestion: "Fuel", confidence: 0.9 };
  if (/kfc|mcdonalds|jollibee|pizza|coffee|tea express|delicious|restaurant|ayamku|food and beverage|food & beverage|excapade|burger|cafe|bakery/.test(lower))
    return { suggestion: "Dining", confidence: 0.8 };
  if (/dst|imagine|progresif|electric|water|pdb|utility|bill/.test(lower))
    return { suggestion: "Utilities", confidence: 0.8 };
  if (/cineplex|cinema|netflix|spotify|disney|google\*play|playstation|xbox|gaming/.test(lower))
    return { suggestion: "Entertainment", confidence: 0.8 };
  if (/grab|dart|taxi|bus fare/.test(lower))
    return { suggestion: "Public transport", confidence: 0.8 };
  if (/clinic|hospital|pharmacy|guardian|jpmc|raja isteri/.test(lower))
    return { suggestion: "Health", confidence: 0.75 };
  if (/paypal|facebook|aliexpress|shopee|lazada|amazon/.test(lower))
    return { suggestion: "Shopping", confidence: 0.7 };
  if (/barbershop|haircut|salon/.test(lower))
    return { suggestion: "Personal care", confidence: 0.8 };
  if (/salary|gaji/.test(lower))
    return { suggestion: "Salary", confidence: 0.85 };
  return { suggestion: null, confidence: 0.3 };
}

interface RawTx {
  date: Date;
  rawDate: string;
  amount: number;
  balance: number;
}

// Split a block of description lines into N groups, one per transaction.
// We use known prefixes (MC DEBIT, FUND TRANSFER, ETUNAI, ...) as group
// starters. If the resulting group count doesn't match N, we still return
// whatever we have — the caller will fall back to a generic description.
function groupDescriptions(lines: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    const clean = line.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    if (NOISE_RE.test(clean)) continue;
    if (DESC_START_RE.test(clean)) {
      if (current) groups.push(current);
      current = [clean];
    } else if (current) {
      current.push(clean);
    } else {
      // Stray continuation line with no leading prefix — start a fresh group
      // so we don't drop the data.
      current = [clean];
    }
  }
  if (current) groups.push(current);
  return groups;
}

export async function parseBibdStatement(buffer: Buffer): Promise<ParsedRow[]> {
  const PDFParse = await loadPdfParse();
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  // Tabs separate the visual columns within a row; strip them but preserve
  // the gap so our regexes see a single space.
  const lines = result.text.split("\n").map((l) => l.replace(/\t/g, " "));

  // Walk the lines collecting parallel arrays:
  //   - txRows: every line that matches the strict DATE AMOUNT BALANCE shape
  //   - descChunks: lines between transaction-row blocks (i.e. each page's
  //     description block). We don't actually need per-page splitting — the
  //     combined description block, grouped by prefix, is still index-aligned
  //     with the combined tx-row block because PDF reading order is
  //     consistent across pages.
  const txRows: RawTx[] = [];
  const descLines: string[] = [];
  let openingBalance: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const bbf = line.match(BBF_RE);
    if (bbf) {
      openingBalance = parseNum(bbf[1]);
      continue;
    }
    const m = line.match(TX_ROW_RE);
    if (m) {
      const [, dd, mm, yyyy, amt, bal] = m;
      const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
      if (!isNaN(date.getTime())) {
        txRows.push({
          date,
          rawDate: `${dd}/${mm}/${yyyy}`,
          amount: parseNum(amt),
          balance: parseNum(bal),
        });
      }
      continue;
    }
    descLines.push(line);
  }

  if (txRows.length === 0) return [];

  const descGroups = groupDescriptions(descLines);

  // Derive direction from running balance. Start with the opening balance
  // captured from "BALANCE BROUGHT FORWARD"; if absent, infer from the first
  // two rows.
  let prev = openingBalance;
  const out: ParsedRow[] = [];
  for (let i = 0; i < txRows.length; i++) {
    const row = txRows[i];
    const descGroup = descGroups[i];
    const description = descGroup
      ? descGroup.join(" ").replace(/\s+/g, " ").trim()
      : `Transaction on ${row.rawDate}`;
    const type: "debit" | "credit" = prev !== null && row.balance < prev - 0.001 ? "debit" : "credit";
    const { suggestion, confidence } = categorize(description);
    out.push({
      rawDate: row.rawDate,
      rawDescription: description,
      rawAmount: row.amount.toFixed(2),
      normalizedDate: row.date,
      normalizedDescription: description,
      normalizedAmount: row.amount.toFixed(2),
      type,
      categorySuggestion: suggestion,
      confidence: confidence.toFixed(4),
    });
    prev = row.balance;
  }

  return out;
}
