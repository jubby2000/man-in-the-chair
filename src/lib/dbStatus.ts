import { create } from 'zustand';

/**
 * Why the app can't safely use its saved data right now. When set, DbNotice
 * covers the app with an explanation instead of letting it fail silently.
 *  - newer:  the data was written by a NEWER version of the app than this one
 *  - stale:  another tab upgraded the database; this tab must reload
 *  - blocked: this tab wants to upgrade but another open tab is in the way
 *  - failed: the browser refused to open storage (private mode, quota, ...)
 */
export type DbIssue = 'newer' | 'stale' | 'blocked' | 'failed';

interface DbStatus {
  issue: DbIssue | null;
  detail: string;
  set: (issue: DbIssue | null, detail?: string) => void;
}

export const useDbStatus = create<DbStatus>((set) => ({
  issue: null,
  detail: '',
  set: (issue, detail = '') => set({ issue, detail }),
}));
