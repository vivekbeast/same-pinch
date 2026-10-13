// Pinch Notes inbox (docs/DECISIONS.md D48): notes from people you played with, newest first, each with
// one-tap preset replies. Opening it clears the unread dot. Hidden entirely when there's nothing to show.
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect } from "react";
import { REGIONS, type NoteKind } from "@shared";
import { Avatar } from "@/components/plates";
import { errorText } from "@/components/states";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { useNotes } from "@/lib/queries";
import { queryClient } from "@/lib/query";
import { toast } from "@/lib/toast";

const REPLIES: NoteKind[] = ["haha_same", "same_brain", "thanks", "hello"];
const regionName = (code: string | null) => REGIONS.find((r) => r.code === code)?.name ?? "";

export function NotesInbox() {
  const notes = useNotes();
  const unread = notes.data?.unread ?? 0;

  // Seeing the list = read. Clear the dot once, then refresh.
  useEffect(() => {
    if (!unread) return;
    void api("/notes/seen", { method: "POST" })
      .then(() => queryClient.invalidateQueries({ queryKey: ["notes"] }))
      .catch(() => undefined);
  }, [unread]);

  const reply = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: NoteKind }) =>
      api(`/notes/${id}/reply`, { method: "POST", body: { kind }, schema: "NoteSent" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
    onError: (e) => toast.error(errorText(e)),
  });

  const list = notes.data?.notes ?? [];
  if (!list.length) return null;

  return (
    <section aria-labelledby="notes" className="flex flex-col gap-2.5">
      <h2 id="notes" className="text-[19px] font-black text-ink md:text-[21px]">
        {t("notes.title")}
      </h2>
      <ul className="flex flex-col gap-2.5">
        {list.slice(0, 8).map((n) => (
          <li key={n.id} className={cn("pop-sm flex flex-col gap-2.5 rounded-tile bg-surface p-3", !n.seen && "ring-2 ring-bubble")}>
            <div className="flex items-center gap-3">
              <Avatar handle={n.from.handle} avatar={n.from.avatar} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-ink-muted">
                  <span className="font-bold text-ink">{n.from.handle}</span>{" "}
                  {n.isReply ? t("notes.replied_you") : t("notes.wrote_you")}
                  {n.from.stateCode ? ` · ${regionName(n.from.stateCode)}` : ""}
                </p>
                <p className="font-display text-[18px] leading-tight font-black text-ink">{t(`notes.kind.${n.kind}`)}</p>
              </div>
            </div>
            {n.canReply ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none" role="group" aria-label={t("notes.reply")}>
                {REPLIES.map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={reply.isPending}
                    onClick={() => reply.mutate({ id: n.id, kind: k })}
                    className="pop-sm press shrink-0 cursor-pointer rounded-full bg-sky-soft px-3 py-1.5 text-[14px] font-bold whitespace-nowrap text-ink [--lip:var(--color-sky)] disabled:opacity-60"
                  >
                    {t(`notes.kind.${k}`)}
                  </button>
                ))}
              </div>
            ) : !n.isReply ? (
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
                <Check className="size-4" aria-hidden />
                {t("notes.reply")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
