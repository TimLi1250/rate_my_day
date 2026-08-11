import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

const execFileAsync = promisify(execFile);
const IMPORT_YEAR = 2026;
const dryRun = process.argv.includes("--dry-run");

// These colors come from the score guide in the supplied sheet. The final two
// are the three slightly lighter green cells the owner confirmed should be 6.
const SCORE_BY_FILL = new Map([
  ["FFFF0000", 1], ["FFFF9900", 2], ["FFFFF2CC", 3], ["FFFFD966", 4], ["FFBF9000", 5],
  ["FFB6D7A8", 6], ["FF6AA84F", 7], ["FF38761D", 8], ["FF274E13", 9], ["FF00FF00", 10],
  ["FFD9EAD3", 6], ["FF93C47D", 6],
]);

const MONTHS = new Map([
  ["january", 1], ["february", 2], ["feburary", 2], ["march", 3], ["april", 4],
  ["may", 5], ["june", 6], ["july", 7], ["august", 8], ["september", 9],
  ["october", 10], ["november", 11], ["december", 12],
]);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Add it to .env.local first.`);
  return value;
}

function decodeXml(value = "") {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function attribute(source, name) {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(source)?.[1];
}

function sharedStrings(xml) {
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) => decodeXml(match[1]));
}

function styleFills(xml) {
  const fills = [...xml.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((match) =>
    attribute(match[1], "rgb")?.toUpperCase() ?? null,
  );
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? "";
  return [...cellXfs.matchAll(/<xf\b([^>]*?)(?:\/>|>)/g)].map((match) => fills[Number(attribute(match[1], "fillId") ?? 0)] ?? null);
}

function worksheetCells(xml, strings, fillsByStyle) {
  const cells = new Map();
  for (const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = match[1];
    const ref = attribute(attrs, "r");
    if (!ref) continue;
    const content = match[2] ?? "";
    const rawValue = /<v>([\s\S]*?)<\/v>/.exec(content)?.[1] ?? "";
    const type = attribute(attrs, "t");
    const value = type === "s" && rawValue ? strings[Number(rawValue)] : decodeXml(rawValue);
    const style = Number(attribute(attrs, "s") ?? 0);
    cells.set(ref, { value: value ?? "", fill: fillsByStyle[style] ?? null });
  }
  return cells;
}

function nextColumn(column) {
  return String.fromCharCode(column.charCodeAt(0) + 1);
}

function makeEntries(cells) {
  const monthColumns = [];
  for (const [reference, cell] of cells) {
    const match = /^([A-Z]+)1$/.exec(reference);
    const month = MONTHS.get(String(cell.value).trim().toLowerCase());
    if (match && month) monthColumns.push({ column: match[1], month });
  }

  const entries = [];
  const skipped = [];
  for (const { column, month } of monthColumns) {
    const commentColumn = nextColumn(column);
    for (let row = 2; row <= 32; row += 1) {
      const ratingCell = cells.get(`${column}${row}`);
      const day = Number(ratingCell?.value);
      if (!Number.isInteger(day) || day < 1 || day > 31) continue;
      const score = SCORE_BY_FILL.get(ratingCell?.fill ?? "");
      if (!score) {
        skipped.push(`${column}${row}`);
        continue;
      }
      const comment = String(cells.get(`${commentColumn}${row}`)?.value ?? "").trim() || null;
      entries.push({
        entryDate: `${IMPORT_YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        score,
        comment,
      });
    }
  }
  return { entries, skipped };
}

function exportUrl(sharedUrl) {
  const id = /spreadsheets\/d\/([^/]+)/.exec(sharedUrl)?.[1];
  if (!id) throw new Error("IMPORT_SHEET_URL must be a Google Sheets sharing link.");
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
}

async function downloadWorkbook(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Sheets download failed (${response.status}). Check sharing access.`);
  const directory = await mkdtemp(path.join(os.tmpdir(), "rate-my-day-import-"));
  const workbookPath = path.join(directory, "source.xlsx");
  await writeFile(workbookPath, Buffer.from(await response.arrayBuffer()));
  return { directory, workbookPath };
}

async function readWorkbook(workbookPath) {
  const extract = async (file) => (await execFileAsync("unzip", ["-p", workbookPath, file])).stdout;
  const [styles, strings, sheet] = await Promise.all([
    extract("xl/styles.xml"), extract("xl/sharedStrings.xml"), extract("xl/worksheets/sheet1.xml"),
  ]);
  return makeEntries(worksheetCells(sheet, sharedStrings(strings), styleFills(styles)));
}

async function ensureSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS profile (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name TEXT NOT NULL, birthday DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS day_entries (
    entry_date DATE PRIMARY KEY, score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10), comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

async function main() {
  const sourceUrl = required("IMPORT_SHEET_URL");
  const { directory, workbookPath } = await downloadWorkbook(exportUrl(sourceUrl));
  try {
    const { entries, skipped } = await readWorkbook(workbookPath);
    if (entries.length !== 178) throw new Error(`Expected 178 rated days but found ${entries.length}; stopping without importing.`);
    console.log(`Parsed ${entries.length} rated days (${entries.filter((entry) => entry.comment).length} with comments) for ${IMPORT_YEAR}.`);
    if (skipped.length) console.log(`Skipped uncolored day cells: ${skipped.join(", ")}.`);
    if (dryRun) return console.log("Dry run complete. No database changes were made.");

    const sql = neon(required("DATABASE_URL"));
    await ensureSchema(sql);
    for (const entry of entries) {
      await sql`INSERT INTO day_entries (entry_date, score, comment) VALUES (${entry.entryDate}::date, ${entry.score}, ${entry.comment})
        ON CONFLICT (entry_date) DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment, updated_at = NOW()`;
    }
    console.log(`Imported ${entries.length} entries into Rate My Day.`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(`Import failed: ${error.message}`); process.exitCode = 1; });
