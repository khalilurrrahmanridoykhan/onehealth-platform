import * as fs from 'fs';
import { classifyAll } from './classify';
import { ALL_DEFINITIONS } from './definitions';
import { PatientInput } from './types';

function printResult(result: ReturnType<typeof classifyAll>[number]): void {
  console.log(`\n${result.diseaseName} (${result.diseaseId}) -- ${result.tier?.toUpperCase()}`);
  for (const [tierName, tierResult] of [
    ['suspected', result.suspected],
    ['probable', result.probable],
    ['confirmed', result.confirmed],
  ] as const) {
    if (!tierResult) continue;
    console.log(`  ${tierName}: ${tierResult.met ? 'MET' : 'not met'}`);
    for (const c of tierResult.matchedCriteria) console.log(`    [x] ${c}`);
    for (const c of tierResult.missingCriteria) console.log(`    [ ] ${c}`);
  }
}

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: ts-node src/cli.ts <patient.json>');
    console.error(`(${ALL_DEFINITIONS.length} disease definitions registered)`);
    process.exit(1);
  }

  const input: PatientInput = JSON.parse(fs.readFileSync(path, 'utf-8'));
  const results = classifyAll(input);

  if (results.length === 0) {
    console.log('No disease definitions matched (not even "suspected") for this patient record.');
    return;
  }

  console.log(`${results.length} disease(s)/condition(s) matched at "suspected" or higher:`);
  for (const r of results) printResult(r);
}

main();
