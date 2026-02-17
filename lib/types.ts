export type TimeEntry = {
  id: number;
  user_id: string;
  category: string;
  seconds: number;
  created_at: string;
};

export type TimeEntryInsert = {
  user_id: string;
  category: string;
  seconds: number;
};

export type AggregatedTimeEntry = {
  category: string;
  seconds: number;
  color: string;
};
