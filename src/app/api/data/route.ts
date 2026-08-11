import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { database, ensureSchema } from "@/lib/db";

function authorized(request: NextRequest) {
  const expected = process.env.RATE_MY_DAY_ACCESS_CODE;
  const supplied = request.headers.get("x-rate-my-day-code") ?? "";
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function denied() {
  return NextResponse.json({ error: "That access code is not right." }, { status: 401 });
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return denied();
  try {
    await ensureSchema();
    const isExport = request.nextUrl.searchParams.get("export") === "1";
    const year = Number(request.nextUrl.searchParams.get("year"));
    if (!isExport && (!Number.isInteger(year) || year < 1900 || year > 3000)) {
      return NextResponse.json({ error: "A valid year is required." }, { status: 400 });
    }
    const sql = database();
    const [profile, entries] = await Promise.all([
      sql`SELECT name, birthday::text FROM profile WHERE id = 1`,
      isExport
        ? sql`SELECT entry_date::text, score, comment FROM day_entries ORDER BY entry_date`
        : sql`SELECT entry_date::text, score, comment FROM day_entries
            WHERE entry_date >= ${`${year}-01-01`}::date AND entry_date <= ${`${year}-12-31`}::date
            ORDER BY entry_date`,
    ]);
    return NextResponse.json({ profile: profile[0] ?? null, entries });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "The diary storage is not connected yet." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (!authorized(request)) return denied();
  try {
    await ensureSchema();
    const body = await request.json();
    const sql = database();
    if (body.type === "profile") {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const birthday = body.birthday === "" || body.birthday === null ? null : body.birthday;
      if (!name || (birthday !== null && !validDate(birthday))) {
        return NextResponse.json({ error: "Please enter a name and a valid birthday." }, { status: 400 });
      }
      const rows = await sql`INSERT INTO profile (id, name, birthday) VALUES (1, ${name}, ${birthday}::date)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, birthday = EXCLUDED.birthday, updated_at = NOW()
        RETURNING name, birthday::text`;
      return NextResponse.json({ profile: rows[0] });
    }
    if (body.type === "entry") {
      const { entry_date: entryDate, score } = body;
      const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) || null : null;
      if (!validDate(entryDate) || !Number.isInteger(score) || score < 1 || score > 10) {
        return NextResponse.json({ error: "Choose a date and a score from 1 to 10." }, { status: 400 });
      }
      const rows = await sql`INSERT INTO day_entries (entry_date, score, comment) VALUES (${entryDate}::date, ${score}, ${comment})
        ON CONFLICT (entry_date) DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment, updated_at = NOW()
        RETURNING entry_date::text, score, comment`;
      return NextResponse.json({ entry: rows[0] });
    }
    return NextResponse.json({ error: "Unknown update." }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "The diary storage is not connected yet." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return denied();
  try {
    await ensureSchema();
    const body = await request.json();
    if (!validDate(body.entry_date)) return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
    const sql = database();
    await sql`DELETE FROM day_entries WHERE entry_date = ${body.entry_date}::date`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "The diary storage is not connected yet." }, { status: 503 });
  }
}
