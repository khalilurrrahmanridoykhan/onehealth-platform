/**
 * Regenerates data/dhis2-crosswalk.json from the disease mapping files in
 * ../dhis2/mappings/*.json -- the single source of truth for which DHIS2
 * organisation unit UID corresponds to which Bangladesh division, already
 * used by 6 of 8 disease programs in this monorepo. Not hand-typed a second
 * time here.
 *
 * Only division-level entries are emitted: the DHIS2 instance doesn't have
 * district/upazila/union organisation units yet (confirmed by reading every
 * mapping file -- none go below division level), so there's nothing real to
 * crosswalk to at those levels today. See the geo service README for what
 * extending this would require.
 *
 * Requires data/admin-geo.json to already exist (run build-data.ts first) --
 * that's where division names are matched against this project's own
 * div_ codes.
 *
 * Usage:
 *   npx ts-node scripts/build-crosswalk.ts [--mappings <dir>] [--admin-geo <path>] [--out <path>]
 */

import * as fs from 'fs';
import * as path from 'path';
import { AdminUnit, CrosswalkEntry } from '../src/types';

interface DiseaseMapping {
  diseaseCode: string;
  locations: Record<
    string,
    { uid: string; name: string; level: 'national' | 'division' | string }
  >;
}

function parseArgs(argv: string[]) {
  let mappingsDir = path.resolve(__dirname, '../../dhis2/mappings');
  let adminGeoPath = path.resolve(__dirname, '../data/admin-geo.json');
  let outPath = path.resolve(__dirname, '../data/dhis2-crosswalk.json');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mappings') mappingsDir = path.resolve(argv[++i]);
    if (argv[i] === '--admin-geo') adminGeoPath = path.resolve(argv[++i]);
    if (argv[i] === '--out') outPath = path.resolve(argv[++i]);
  }
  return { mappingsDir, adminGeoPath, outPath };
}

function main() {
  const { mappingsDir, adminGeoPath, outPath } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(adminGeoPath)) {
    throw new Error(`${adminGeoPath} not found -- run "npm run build-data" first.`);
  }
  const adminUnits: AdminUnit[] = JSON.parse(fs.readFileSync(adminGeoPath, 'utf-8'));
  const divisionsByName = new Map(
    adminUnits.filter((u) => u.level === 'division').map((u) => [u.name.trim().toLowerCase(), u]),
  );

  const mappingFiles = fs.readdirSync(mappingsDir).filter((f) => f.endsWith('.json'));

  // uid -> { name, confirmedInMappings[] }
  const uidToDivision = new Map<string, { name: string; confirmedInMappings: string[] }>();

  for (const file of mappingFiles) {
    const mapping: DiseaseMapping = JSON.parse(fs.readFileSync(path.join(mappingsDir, file), 'utf-8'));
    for (const loc of Object.values(mapping.locations)) {
      if (loc.level !== 'division') continue;
      const existing = uidToDivision.get(loc.uid);
      if (existing) {
        existing.confirmedInMappings.push(mapping.diseaseCode);
      } else {
        uidToDivision.set(loc.uid, { name: loc.name, confirmedInMappings: [mapping.diseaseCode] });
      }
    }
  }

  const crosswalk: CrosswalkEntry[] = [];
  const unmatched: string[] = [];

  for (const [uid, { name, confirmedInMappings }] of uidToDivision) {
    const geoUnit = divisionsByName.get(name.trim().toLowerCase());
    if (!geoUnit) {
      unmatched.push(`DHIS2 division "${name}" (${uid}) has no matching div_ code in admin-geo.json`);
      continue;
    }
    crosswalk.push({
      geoCode: geoUnit.code,
      dhis2OrgUnitUid: uid,
      dhis2OrgUnitName: name,
      confirmedInMappings: confirmedInMappings.sort(),
    });
  }

  if (unmatched.length > 0) {
    throw new Error(
      `Crosswalk build failed -- name mismatch between DHIS2 mappings and admin-geo.json:\n` +
        unmatched.join('\n'),
    );
  }
  if (crosswalk.length !== 8) {
    throw new Error(`Expected exactly 8 division-level crosswalk entries, got ${crosswalk.length}.`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(crosswalk, null, 2));

  console.log(`Wrote ${crosswalk.length} crosswalk entries to ${outPath}`);
}

main();
