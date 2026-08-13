import * as fs from 'fs';
import * as path from 'path';
import { AdminUnit } from './types';

export class GeoStore {
  private readonly byCode = new Map<string, AdminUnit>();
  private readonly childrenByParent = new Map<string, AdminUnit[]>();

  constructor(units: AdminUnit[]) {
    for (const unit of units) {
      this.byCode.set(unit.code, unit);
    }
    for (const unit of units) {
      if (unit.parentCode === null) continue;
      const siblings = this.childrenByParent.get(unit.parentCode) ?? [];
      siblings.push(unit);
      this.childrenByParent.set(unit.parentCode, siblings);
    }
  }

  static fromFile(filePath: string): GeoStore {
    const units: AdminUnit[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return new GeoStore(units);
  }

  get(code: string): AdminUnit | undefined {
    return this.byCode.get(code);
  }

  childrenOf(parentCode: string): AdminUnit[] {
    return this.childrenByParent.get(parentCode) ?? [];
  }

  divisions(): AdminUnit[] {
    return [...this.byCode.values()].filter((u) => u.level === 'division');
  }
}

export const DEFAULT_ADMIN_GEO_PATH = path.resolve(__dirname, '../data/admin-geo.json');
