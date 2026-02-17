export interface TimeEntry {
  id: number;
  user_id: string;
  category: string;
  seconds: number;
  created_at: string;
}

export interface TimeEntryInsert {
  user_id: string;
  category: string;
  seconds: number;
}

export interface AggregatedTimeEntry {
  category: string;
  seconds: number;
  color: string;
}
