"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { friendlyDate, isoDate, MONTHS, daysInMonth } from "@/lib/dates";
import type { DashboardData, DayEntry, Profile } from "@/lib/types";

const SCORE_COLORS = [
  "#ed3f35", "#ff7a1a", "#ff9d27", "#ffd85a", "#f7e8a7",
  "#c4dca9", "#97c776", "#68a94e", "#3d7d30", "#1d5824",
];

const TODAY = new Date();
const INITIAL_YEAR = TODAY.getFullYear();

function scoreStyle(score?: number) {
  return score ? { backgroundColor: SCORE_COLORS[score - 1] } : undefined;
}

function loadSavedCode() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("rate-my-day-access-code") ?? "";
}

export default function RateMyDayApp() {
  const [accessCode, setAccessCode] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [year, setYear] = useState(INITIAL_YEAR);
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedDate, setSelectedDate] = useState(isoDate(INITIAL_YEAR, TODAY.getMonth(), TODAY.getDate()));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccessCode(loadSavedCode());
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-rate-my-day-code": accessCode,
        ...(init?.headers ?? {}),
      },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
    return body;
  }

  async function refresh(targetYear = year) {
    if (!accessCode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await request(`/api/data?year=${targetYear}`);
      setData(result);
    } catch (reason) {
      setData(null);
      setError(reason instanceof Error ? reason.message : "Unable to open your diary.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (accessCode) void refresh();
    // refresh deliberately runs when the selected year or saved code changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessCode, year]);

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = codeDraft.trim();
    if (!trimmed) return;
    window.localStorage.setItem("rate-my-day-access-code", trimmed);
    setAccessCode(trimmed);
  }

  function changeYear(nextYear: number) {
    setYear(nextYear);
    const [selectedYear, month, day] = selectedDate.split("-").map(Number);
    if (selectedYear !== nextYear) {
      setSelectedDate(isoDate(nextYear, month - 1, Math.min(day, daysInMonth(nextYear, month - 1))));
    }
  }

  async function saveProfile(profile: Profile) {
    setSaving(true);
    try {
      const result = await request("/api/data", { method: "PUT", body: JSON.stringify({ type: "profile", ...profile }) });
      setData((current) => current ? { ...current, profile: result.profile } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEntry(entry: Pick<DayEntry, "entry_date" | "score" | "comment">) {
    setSaving(true);
    try {
      const result = await request("/api/data", { method: "PUT", body: JSON.stringify({ type: "entry", ...entry }) });
      setData((current) => {
        if (!current) return current;
        const entries = current.entries.filter((item) => item.entry_date !== result.entry.entry_date);
        return { ...current, entries: [...entries, result.entry] };
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your day could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entryDate: string) {
    setSaving(true);
    try {
      await request("/api/data", { method: "DELETE", body: JSON.stringify({ entry_date: entryDate }) });
      setData((current) => current ? { ...current, entries: current.entries.filter((item) => item.entry_date !== entryDate) } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your day could not be cleared.");
    } finally {
      setSaving(false);
    }
  }

  async function exportDiary() {
    setError("");
    try {
      const backup = await request("/api/data?export=1");
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...backup }, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `rate-my-day-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your backup could not be created.");
    }
  }

  if (!accessCode) return <AccessCodeScreen codeDraft={codeDraft} setCodeDraft={setCodeDraft} onSubmit={unlock} />;

  if (loading) return <main className="loading-page"><span className="loading-orb" />Opening your year…</main>;

  if (error && !data) {
    return <main className="access-page"><section className="access-card error-card"><p className="eyebrow">RATE MY DAY</p><h1>We couldn’t open your diary.</h1><p>{error}</p><button className="primary-button" onClick={() => void refresh()}>Try again</button><button className="quiet-button" onClick={() => { window.localStorage.removeItem("rate-my-day-access-code"); setAccessCode(""); }}>Use another code</button></section></main>;
  }

  if (data && !data.profile) return <Onboarding onSave={saveProfile} saving={saving} error={error} />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">A YEAR IN LITTLE MOMENTS</p><h1>Rate My Day</h1></div>
        <div className="topbar-actions">
          <span className="hello">Hi, {data?.profile?.name}</span>
          <button className="backup-button" onClick={() => void exportDiary()}>Backup</button>
          <button className="year-button" aria-label="Previous year" onClick={() => changeYear(year - 1)}>←</button>
          <span className="year-value">{year}</span>
          <button className="year-button" aria-label="Next year" onClick={() => changeYear(year + 1)}>→</button>
        </div>
      </header>

      {error && <p className="notice" role="status">{error}</p>}

      <section className="welcome-strip">
        <div><span className="sun-mark">✦</span><strong>Every square is a small memory.</strong><span>Choose a day to give it a color.</span></div>
        <button className="today-link" onClick={() => { changeYear(INITIAL_YEAR); setSelectedDate(isoDate(INITIAL_YEAR, TODAY.getMonth(), TODAY.getDate())); }}>Go to today</button>
      </section>

      <div className="tracker-layout">
        <YearGrid year={year} entries={data?.entries ?? []} selectedDate={selectedDate} onSelect={setSelectedDate} />
        <aside className="side-panel">
          <ScoreLegend />
          <DayEditor key={selectedDate} date={selectedDate} entry={data?.entries.find((item) => item.entry_date === selectedDate)} onSave={saveEntry} onDelete={deleteEntry} saving={saving} />
        </aside>
      </div>
      <footer><span>1 — Worst</span><span>10 — Best</span><span>Made for your everyday.</span></footer>
    </main>
  );
}

function AccessCodeScreen({ codeDraft, setCodeDraft, onSubmit }: { codeDraft: string; setCodeDraft: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <main className="access-page"><section className="access-card"><p className="eyebrow">WELCOME TO</p><h1>Rate My Day</h1><p className="intro">A private place for all the little days that make up your year.</p><form onSubmit={onSubmit}><label htmlFor="access-code">Your personal access code</label><input id="access-code" type="password" autoComplete="current-password" value={codeDraft} onChange={(event) => setCodeDraft(event.target.value)} placeholder="Enter your code" required /><button className="primary-button" type="submit">Open my diary <span>→</span></button></form><p className="access-note">You only need this when opening Rate My Day on a new device.</p></section></main>;
}

function Onboarding({ onSave, saving, error }: { onSave: (profile: Profile) => Promise<void>; saving: boolean; error: string }) {
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  return <main className="access-page"><section className="access-card onboarding-card"><p className="eyebrow">MAKE IT YOURS</p><h1>Before we begin…</h1><p className="intro">Let’s put your name on this little corner of the year.</p><form onSubmit={(event) => { event.preventDefault(); void onSave({ name, birthday: birthday || null }); }}><label htmlFor="name">What should we call you?</label><input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={80} required autoFocus /><label htmlFor="birthday">Birthday <span>(optional)</span></label><input id="birthday" type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} /><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Start my year"} <span>→</span></button></form>{error && <p className="form-error">{error}</p>}</section></main>;
}

function YearGrid({ year, entries, selectedDate, onSelect }: { year: number; entries: DayEntry[]; selectedDate: string; onSelect: (date: string) => void }) {
  const entryByDate = useMemo(() => new Map(entries.map((entry) => [entry.entry_date, entry])), [entries]);
  return <section className="year-card" aria-label={`${year} day ratings`}><div className="grid-and-notes"><div className="grid-column"><div className="grid-scroll"><div className="year-grid"><div className="corner-label">DAY</div>{MONTHS.map((month) => <div className="month-label" key={month}>{month.slice(0, 3)}</div>)}{Array.from({ length: 31 }, (_, index) => { const day = index + 1; return <DayRow key={day} day={day} year={year} entryByDate={entryByDate} selectedDate={selectedDate} onSelect={onSelect} />; })}</div></div><p className="grid-caption">Tap a colored square to revisit it.</p></div><YearNotes entries={entries} selectedDate={selectedDate} onSelect={onSelect} /></div></section>;
}

function DayRow({ day, year, entryByDate, selectedDate, onSelect }: { day: number; year: number; entryByDate: Map<string, DayEntry>; selectedDate: string; onSelect: (date: string) => void }) {
  return <><span className="day-number">{day}</span>{MONTHS.map((month, monthIndex) => { const exists = day <= daysInMonth(year, monthIndex); if (!exists) return <span className="day-cell unavailable" aria-hidden="true" key={month} />; const date = isoDate(year, monthIndex, day); const entry = entryByDate.get(date); const selected = selectedDate === date; return <button key={month} className={`day-cell ${selected ? "selected" : ""} ${entry ? "rated" : ""}`} style={scoreStyle(entry?.score)} aria-label={`${friendlyDate(date)}${entry ? `, rated ${entry.score} out of 10` : ", not rated"}`} aria-pressed={selected} onClick={() => onSelect(date)} />; })}</>;
}

function YearNotes({ entries, selectedDate, onSelect }: { entries: DayEntry[]; selectedDate: string; onSelect: (date: string) => void }) {
  const notes = entries.filter((entry) => entry.comment).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  return <section className="year-notes" aria-label="Notes from your year"><div className="notes-heading"><div><p className="section-kicker">NOTES FROM YOUR YEAR</p><h2>Little memories</h2></div><span>{notes.length}</span></div>{notes.length === 0 ? <p className="empty-notes">When you add a note to a day, it will live here—right beside your year.</p> : <div className="notes-list">{notes.map((entry) => <button className={`note-row ${selectedDate === entry.entry_date ? "selected" : ""}`} key={entry.entry_date} onClick={() => onSelect(entry.entry_date)}><span className="note-dot" style={scoreStyle(entry.score)} /><span className="note-copy"><strong>{friendlyDate(entry.entry_date)}</strong><span>{entry.comment}</span></span></button>)}</div>}</section>;
}

function ScoreLegend() {
  return <section className="legend" aria-label="Score legend"><p className="section-kicker">YOUR COLOR SCALE</p><div className="legend-ends"><span>Worst</span><span>Best</span></div><div className="legend-scale">{SCORE_COLORS.map((color, index) => <span style={{ backgroundColor: color }} key={color} aria-label={`Score ${index + 1}`}>{index + 1}</span>)}</div></section>;
}

function DayEditor({ date, entry, onSave, onDelete, saving }: { date: string; entry?: DayEntry; onSave: (entry: Pick<DayEntry, "entry_date" | "score" | "comment">) => Promise<void>; onDelete: (date: string) => Promise<void>; saving: boolean }) {
  const [score, setScore] = useState<number | null>(entry?.score ?? null);
  const [comment, setComment] = useState(entry?.comment ?? "");
  const canSave = score !== null && !saving;
  return <section className="editor"><div className="editor-heading"><p className="section-kicker">SELECTED DAY</p><h2>{friendlyDate(date)}</h2></div><fieldset><legend>How did it go?</legend><div className="score-picker">{SCORE_COLORS.map((color, index) => { const value = index + 1; return <button type="button" key={value} className={score === value ? "active" : ""} style={{ backgroundColor: color }} aria-label={value === 1 ? "1, worst" : value === 10 ? "10, best" : String(value)} aria-pressed={score === value} onClick={() => setScore(value)}>{value}</button>; })}</div></fieldset><label className="comment-label" htmlFor="comment">A note for this day <span>optional</span></label><textarea id="comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What made this day memorable?" maxLength={2000} rows={4} /><div className="editor-actions"><button className="primary-button" disabled={!canSave} onClick={() => { if (score) void onSave({ entry_date: date, score, comment }); }}>{saving ? "Saving…" : entry ? "Update day" : "Save day"}</button>{entry && <button className="delete-button" disabled={saving} onClick={() => void onDelete(date)}>Clear</button>}</div></section>;
}
