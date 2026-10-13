// Pinch Notes (docs/DECISIONS.md D48): after a round, a preset note to your partner; they can reply once.
// Async by design — partners are recorded answers, so the other player sees it next time they open People.
// DTOs carry handles/avatars/states and the note's own id only — never user ids.
import { randomInt } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { NOTE_KINDS, type api, type NoteKind, type z } from "@shared";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { notes, users } from "../db/schema.js";
import { AppError, pgCode } from "../lib/errors.js";

type NotesDto = z.infer<typeof api.NotesResponse>;
type NoteDto = NotesDto["notes"][number];

/** Seeded partners can't answer for themselves — in demo mode they reply right away so the loop is visible. */
async function demoAutoReply(noteId: string, seedUser: string, to: string) {
  if (!env.DEMO_MODE) return;
  const [u] = await db.select({ isSeed: users.isSeed }).from(users).where(eq(users.id, seedUser));
  if (!u?.isSeed) return;
  const kinds: NoteKind[] = ["haha_same", "same_brain", "thanks", "hello"];
  await db
    .insert(notes)
    .values({ fromUser: seedUser, toUser: to, replyTo: noteId, kind: kinds[randomInt(kinds.length)]! })
    .onConflictDoNothing();
}

/** POST /notes — to the partner on one of *your* rounds. One per round. */
export async function sendNote(userId: string, attemptId: string, kind: NoteKind) {
  const rows = await db.execute<{ partner_user: string | null }>(sql`
    select p.user_id as partner_user
    from answers a
    join answers p on p.id = a.partner_answer_id
    where a.id = ${attemptId} and a.user_id = ${userId}`);
  const row = rows[0] ? { partnerUser: rows[0].partner_user } : null;
  // Not your round, no partner, or the partner deleted their account (answers outlive users).
  if (!row?.partnerUser || row.partnerUser === userId) throw new AppError("NOT_FOUND");
  try {
    const [n] = await db
      .insert(notes)
      .values({ fromUser: userId, toUser: row.partnerUser, answerId: attemptId, kind })
      .returning({ id: notes.id });
    await demoAutoReply(n!.id, row.partnerUser, userId);
  } catch (e) {
    if (pgCode(e) === "23505") throw new AppError("ALREADY_ANSWERED"); // already sent a note on this round
    throw e;
  }
}

/** POST /notes/:id/reply — only the recipient, only once. */
export async function replyNote(userId: string, noteId: string, kind: NoteKind) {
  const [n] = await db
    .select({ fromUser: notes.fromUser, toUser: notes.toUser, replyTo: notes.replyTo })
    .from(notes)
    .where(eq(notes.id, noteId));
  if (!n || n.toUser !== userId) throw new AppError("NOT_FOUND");
  if (n.replyTo) throw new AppError("FORBIDDEN"); // replies are the end of a thread
  try {
    await db.insert(notes).values({ fromUser: userId, toUser: n.fromUser, replyTo: noteId, kind });
  } catch (e) {
    if (pgCode(e) === "23505") throw new AppError("ALREADY_ANSWERED");
    throw e;
  }
}

/** GET /notes — newest 30 to me, with whether I can still reply. */
export async function inbox(userId: string): Promise<NotesDto> {
  const rows = await db.execute<{
    id: string;
    handle: string;
    avatar: string;
    state_code: string | null;
    kind: string;
    created_at: Date;
    seen_at: Date | null;
    reply_to: string | null;
    replied: boolean;
  }>(sql`
    select n.id, u.handle, u.avatar, u.state_code, n.kind, n.created_at, n.seen_at, n.reply_to,
           exists (select 1 from notes r where r.reply_to = n.id) as replied
    from notes n
    join users u on u.id = n.from_user
    where n.to_user = ${userId} and not u.is_flagged
    order by n.created_at desc
    limit 30`);
  const list: NoteDto[] = rows.map((r) => ({
    id: r.id,
    from: {
      handle: r.handle,
      avatar: r.avatar as NoteDto["from"]["avatar"],
      stateCode: (r.state_code as NoteDto["from"]["stateCode"]) ?? null,
    },
    kind: (NOTE_KINDS as readonly string[]).includes(r.kind) ? (r.kind as NoteKind) : "hello",
    at: new Date(r.created_at).toISOString(),
    seen: r.seen_at !== null,
    isReply: r.reply_to !== null,
    canReply: r.reply_to === null && !r.replied,
  }));
  return { notes: list, unread: list.filter((n) => !n.seen).length };
}

/** POST /notes/seen — clears the unread dot. */
export async function markSeen(userId: string) {
  await db
    .update(notes)
    .set({ seenAt: new Date() })
    .where(and(eq(notes.toUser, userId), isNull(notes.seenAt)));
}

