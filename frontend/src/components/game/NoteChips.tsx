// Pinch Notes (docs/DECISIONS.md D48): after a round, one preset note to your partner — tap and it's sent.
// Presets only (no free text between strangers). Async: they see it in People and can reply once.
// `local` mode (practice game) never touches the network and plays a scripted reply.
import { useMutation } from "@tanstack/react-query";
import { m, useReducedMotion } from "motion/react";
import { Check, Send } from "lucide-react";
import { useEffect, useState } from "react";
import type { NoteKind } from "@shared";
import { Avatar } from "@/components/plates";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { spring } from "@/lib/motion";
import { queryClient } from "@/lib/query";
import { toast } from "@/lib/toast";
import { errorText } from "@/components/states";

/** The four that make sense right after a round (reply-only kinds live in People). */
export const AFTER_ROUND: NoteKind[] = ["same_brain", "haha_same", "never_thought", "hello"];

export function NoteChips({
  attemptId,
  partner,
  local,
  className,
}: {
  attemptId?: string | null;
  partner: { handle: string; avatar: string };
  /** Practice: no network; `reply` is shown a beat after sending. */
  local?: { reply: NoteKind };
  className?: string;
}) {
  const still = useReducedMotion();
  const [sent, setSent] = useState<NoteKind | null>(null);
  const [reply, setReply] = useState<NoteKind | null>(null);
  const send = useMutation({
    mutationFn: (kind: NoteKind) => api("/notes", { method: "POST", body: { attemptId, kind }, schema: "NoteSent" }),
    onSuccess: (_, kind) => {
      setSent(kind);
      void queryClient.invalidateQueries({ queryKey: ["notes"] }); // demo partners reply right away
    },
    onError: (e, kind) => {
      if (e instanceof ApiError && e.code === "ALREADY_ANSWERED") setSent(kind);
      else toast.error(errorText(e));
    },
  });

  useEffect(() => {
    if (!local || !sent) return;
    const id = setTimeout(() => setReply(local.reply), still ? 0 : 1100);
    return () => clearTimeout(id);
  }, [local, sent, still]);

  if (!local && !attemptId) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {sent ? (
        <p className="flex items-center gap-2 text-[14px] font-semibold text-ink-2" role="status">
          <span className="grid size-5 place-items-center rounded-full bg-lime text-ink">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          </span>
          {t("notes.sent", { name: partner.handle, note: t(`notes.kind.${sent}`) })}
        </p>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-muted">
            <Send className="size-4" aria-hidden />
            {t("notes.send_to", { name: partner.handle })}
          </p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" role="group" aria-label={t("notes.send_to", { name: partner.handle })}>
            {AFTER_ROUND.map((k) => (
              <button
                key={k}
                type="button"
                disabled={send.isPending}
                onClick={() => (local ? setSent(k) : send.mutate(k))}
                className="pop-sm press shrink-0 cursor-pointer rounded-full bg-bubble-soft px-3.5 py-2 text-[15px] font-bold whitespace-nowrap text-ink [--lip:var(--color-bubble)] disabled:opacity-60"
              >
                {t(`notes.kind.${k}`)}
              </button>
            ))}
          </div>
        </>
      )}
      {reply ? (
        <m.p
          initial={still ? false : { opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={spring.bouncy}
          className="flex items-center gap-2 self-start rounded-[18px] rounded-bl-[6px] bg-sky-soft py-1.5 pr-3.5 pl-1.5 text-[15px] font-bold text-ink pop-sm"
        >
          <Avatar handle={partner.handle} avatar={partner.avatar} size={26} />
          {t(`notes.kind.${reply}`)}
        </m.p>
      ) : null}
    </div>
  );
}
