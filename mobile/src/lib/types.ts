export type Entry = {
  id: string;
  userId: string;
  work_name: string;
  chapter: string;
  work_type: string;
  total: number;
  notes: string;
  timestamp: string;
  month_key: string;
  username: string;
  added_by?: string;
};
export type Work = {
  name: string;
  isolated?: boolean;
  active?: boolean;
  paid_start?: number | null;
  custom_prices?: Record<string, number>;
  azora?: {
    slug: string;
    linked_by?: string;
    linked_at?: string;
    post_id?: number;
    title_en?: string;
    cover?: string;
    title?: string;
    description?: string;
    latestChapter?: string;
    chapterCount?: number;
  };
};
export type Member = {
  id: string;
  name: string;
  avatar?: string;
  username?: string;
  nickname?: string | null;
  globalName?: string | null;
  joinedAt?: string;
  firstLoginAt?: string;
  lastLoginAt?: string;
  appRegistered?: boolean;
  isAdmin?: boolean;
  blocked?: boolean;
  title?: string;
};
export type Audit = {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  moderator_id: string;
};
export type Snapshot = {
  version: 1;
  records: Entry[];
  works: Work[];
  members: Member[];
  specialties: Record<string, { price: number; active: boolean }>;
  months: { key: string; name: string }[];
  settings: {
    currency: string;
    active_month: string;
    payment_day: number | null;
    payment_hour: number;
    alert_threshold: number;
  };
  audit: Audit[];
};
export type Identity = {
  id: string;
  name: string;
  isAdmin: boolean;
  avatar?: string;
};
export type Totals = {
  chapters: number;
  amount: number;
  bonuses: number;
  deductions: number;
  works: number;
};
