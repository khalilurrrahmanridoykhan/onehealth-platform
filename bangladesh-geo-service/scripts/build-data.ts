/**
 * Regenerates data/admin-geo.json from the bangladesh-admin-boundary-xlsform
 * project's already-validated `choices` sheet, rather than re-deriving from
 * the raw shapefiles a second time here (that would just re-risk the
 * duplicate-GEO_CODE issue the xlsform project's dissolve() step already
 * fixed once).
 *
 * The source xlsx lives in a sibling repo on this machine, not inside
 * onehealth-platform -- pass --xlsx to point at your own local copy if the
 * default relative path doesn't resolve (e.g. on a fresh clone of this repo
 * without the sibling xlsform repo checked out alongside it).
 *
 * Usage:
 *   npx ts-node scripts/build-data.ts [--xlsx <path>] [--out <path>]
 */

import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { AdminLevel, AdminUnit } from '../src/types';

const LEVEL_BY_PREFIX: Record<string, AdminLevel> = {
  div_: 'division',
  dis_: 'district',
  upa_: 'upazila',
  uni_: 'union',
};

const PARENT_FILTER_COLUMN: Record<AdminLevel, string | null> = {
  division: null,
  district: 'div_filter',
  upazila: 'dis_filter',
  union: 'upa_filter',
};

const EXPECTED_COUNTS: Record<AdminLevel, number> = {
  division: 8,
  district: 64,
  upazila: 590,
  union: 4926,
};

function parseArgs(argv: string[]): { xlsx: string; out: string } {
  const defaultXlsx = path.resolve(
    __dirname,
    '../../../bangladesh-admin-boundary-xlsform/forms/Full Bangladesh Division To Union (with map + boundaries).xlsx',
  );
  const defaultOut = path.resolve(__dirname, '../data/admin-geo.json');

  let xlsxPath = defaultXlsx;
  let outPath = defaultOut;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--xlsx') xlsxPath = path.resolve(argv[++i]);
    if (argv[i] === '--out') outPath = path.resolve(argv[++i]);
  }
  return { xlsx: xlsxPath, out: outPath };
}

async function buildAdminGeo(xlsxPath: string): Promise<AdminUnit[]> {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(
      `Source xlsx not found at ${xlsxPath}. Pass --xlsx <path> to point at your local copy of ` +
        `"Full Bangladesh Division To Union (with map + boundaries).xlsx" from the ` +
        `bangladesh-admin-boundary-xlsform repo.`,
    );
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);
  const sheet = workbook.getWorksheet('choices');
  if (!sheet) throw new Error(`No "choices" sheet found in ${xlsxPath}`);

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '');
  });

  const units: AdminUnit[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const rec: Record<string, string | number | undefined> = {};
    headers.forEach((h, colNumber) => {
      if (!h) return;
      const value = row.getCell(colNumber).value;
      rec[h] = value === null || value === undefined ? undefined : (value as string | number);
    });

    const listName = String(rec.list_name ?? '');
    const level = LEVEL_BY_PREFIX[listName];
    if (!level) continue; // skip anything unexpected rather than guessing

    const parentFilterCol = PARENT_FILTER_COLUMN[level];
    const parentCode = parentFilterCol ? ((rec[parentFilterCol] as string) ?? null) : null;

    units.push({
      code: String(rec.name),
      level,
      name: String(rec.label),
      parentCode,
      latitude: Number(rec.latitude),
      longitude: Number(rec.longitude),
      ...(rec.geometry ? { geometry: String(rec.geometry) } : {}),
    });
  }

  return units;
}

async function main() {
  const { xlsx: xlsxPath, out: outPath } = parseArgs(process.argv.slice(2));
  const units = await buildAdminGeo(xlsxPath);

  const counts: Record<string, number> = {};
  for (const u of units) counts[u.level] = (counts[u.level] ?? 0) + 1;

  for (const [level, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = counts[level] ?? 0;
    if (actual !== expected) {
      throw new Error(
        `Row count mismatch for ${level}: expected ${expected}, got ${actual}. ` +
          `Source data may have changed -- verify before shipping this output.`,
      );
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(units, null, 2));

  console.log(`Wrote ${units.length} admin units to ${outPath}`);
  console.log(counts);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
