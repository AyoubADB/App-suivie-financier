import Dexie, { type EntityTable } from 'dexie';
import type { Activity, Badge, Budget, Category, Transaction } from '../types';
import { DEFAULT_BADGES, DEFAULT_CATEGORIES } from './seed';

export interface SettingRow {
  key: string;
  value: string;
}

export class FlowDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  badges!: EntityTable<Badge, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor() {
    super('flow-db');
    this.version(1).stores({
      transactions: 'id, date, scope, type, categoryId, isRecurring',
      categories: 'id, scope, type',
      badges: 'id',
      settings: 'key',
    });
    this.version(2).stores({
      budgets: 'id, categoryId, scope',
    });
    this.version(3).stores({
      activities: 'id, archived',
      transactions: 'id, date, scope, type, categoryId, isRecurring, activityId',
    });
    this.on('populate', async () => {
      await this.categories.bulkAdd(DEFAULT_CATEGORIES);
      await this.badges.bulkAdd(DEFAULT_BADGES);
    });
  }
}

export const db = new FlowDB();
