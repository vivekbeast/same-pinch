-- Money guards (AGENTS.md: "Ledger is append-only", "Earned money never goes down").
-- Enforced in the database so no code path — buggy service, manual SQL, future feature — can bypass them.

-- ---------- ledger: append-only ----------
-- Allowed changes after insert:
--   * status moves forward:  pending_review → credited   (held earnings released)
--                            pending → paid | failed     (payout settled)
--   * pack_id / payout_id set to NULL by FK "on delete set null"
-- Deleting rows is only allowed when the owning user is being deleted (ON DELETE CASCADE, DPDP erasure).
CREATE OR REPLACE FUNCTION ledger_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
      RAISE EXCEPTION 'ledger is append-only: cannot delete entry %', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.amount_paise IS DISTINCT FROM OLD.amount_paise
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.pack_id IS DISTINCT FROM OLD.pack_id AND NEW.pack_id IS NOT NULL)
     OR (NEW.payout_id IS DISTINCT FROM OLD.payout_id AND NEW.payout_id IS NOT NULL) THEN
    RAISE EXCEPTION 'ledger is append-only: only status may change on entry %', OLD.id USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'pending_review' AND NEW.status = 'credited')
    OR (OLD.status = 'pending' AND NEW.status IN ('paid', 'failed'))
  ) THEN
    RAISE EXCEPTION 'ledger status cannot move % -> % on entry %', OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_guard
  BEFORE UPDATE OR DELETE ON ledger
  FOR EACH ROW EXECUTE FUNCTION ledger_guard();
--> statement-breakpoint

-- ---------- payouts: amount and owner are immutable, status only settles once ----------
CREATE OR REPLACE FUNCTION payout_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
      RAISE EXCEPTION 'payouts cannot be deleted (payout %)', OLD.id USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.amount_paise IS DISTINCT FROM OLD.amount_paise
     OR NEW.upi_masked IS DISTINCT FROM OLD.upi_masked
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'payout % is immutable except for its status', OLD.id USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'pending' AND NEW.status IN ('paid', 'failed')) THEN
    RAISE EXCEPTION 'payout status cannot move % -> % (payout %)', OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payout_guard
  BEFORE UPDATE OR DELETE ON payouts
  FOR EACH ROW EXECUTE FUNCTION payout_guard();
--> statement-breakpoint

-- ---------- balance view: one definition of "what the user can spend" ----------
-- balance  = credited earnings/adjustments − payouts that are pending or paid (failed payouts return money)
-- held     = earnings waiting for review (shown as "Pending", not spendable)
CREATE VIEW user_balances AS
SELECT
  u.id AS user_id,
  COALESCE(SUM(l.amount_paise) FILTER (
    WHERE (l.kind IN ('earn', 'reversal', 'adjustment') AND l.status = 'credited')
       OR (l.kind = 'payout' AND l.status IN ('pending', 'paid'))
  ), 0)::bigint AS balance_paise,
  COALESCE(SUM(l.amount_paise) FILTER (WHERE l.kind = 'earn' AND l.status = 'pending_review'), 0)::bigint AS held_paise,
  COALESCE(-SUM(l.amount_paise) FILTER (WHERE l.kind = 'payout' AND l.status = 'pending'), 0)::bigint AS payout_pending_paise,
  COALESCE(-SUM(l.amount_paise) FILTER (WHERE l.kind = 'payout' AND l.status = 'paid'), 0)::bigint AS paid_out_paise
FROM users u
LEFT JOIN ledger l ON l.user_id = u.id
GROUP BY u.id;
