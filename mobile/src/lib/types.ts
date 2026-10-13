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
  azora?: { slug: string };
};
export type Member = { id: string; name: string; avatar?: string };
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
};
export type Totals = {
  chapters: number;
  amount: number;
  bonuses: number;
  deductions: number;
  works: number;
};
