export type Profile = {
  name: string;
  birthday: string | null;
};

export type DayEntry = {
  entry_date: string;
  score: number;
  comment: string | null;
};

export type DashboardData = {
  profile: Profile | null;
  entries: DayEntry[];
};
