import * as fs from 'fs';
import * as path from 'path';
import { CrosswalkEntry } from './types';

export class CrosswalkStore {
  private readonly byGeoCode = new Map<string, CrosswalkEntry>();

  constructor(entries: CrosswalkEntry[]) {
    for (const entry of entries) {
      this.byGeoCode.set(entry.geoCode, entry);
    }
  }

  static fromFile(filePath: string): CrosswalkStore {
    const entries: CrosswalkEntry[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return new CrosswalkStore(entries);
  }

  get(geoCode: string): CrosswalkEntry | undefined {
    return this.byGeoCode.get(geoCode);
  }
}

export const DEFAULT_CROSSWALK_PATH = path.resolve(__dirname, '../data/dhis2-crosswalk.json');
