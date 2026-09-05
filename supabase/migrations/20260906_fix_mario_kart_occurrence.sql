-- Data fix: correct the mario kart listing's next occurrence.
--
-- The backfill carried this chain's date over faithfully from its live child,
-- but that child's date was already wrong. The host posts on the FIRST TUESDAY
-- of the month (4 Aug, 1 Sep, 6 Oct), and 'monthly' is implemented as a flat
-- 30-day step, which drifts off the weekday:
--
--   4 Aug (Tue) + 30 = 3 Sep (Thu) + 30 = 3 Oct (Sat)
--
-- The drift is visible in the chain's own history: one archived child has
-- time = 'Tuesday 1 September' but an occurrence of Thursday 3 September, and
-- the next reads 'Saturday, 3rd October'. Confirmed by the host.
--
-- This corrects the stored date only. The `time` column is untouched, as ever.
UPDATE posts
SET next_occurrence_at = '2026-10-06'::timestamptz,
    expires_at         = '2026-10-07'::timestamptz
WHERE id = '3bc77b7e-2c3a-4950-9fc6-e6685cfc5c08'
  AND status = 'approved';

-- KNOWN LIMITATION, NOT FIXED HERE.
--
-- recurrence_interval_days('monthly') is 30 days, so this listing will drift
-- again at the next roll: 6 Oct + 30 = 5 Nov, a Thursday, not the first Tuesday
-- (3 Nov). Weekly and biweekly are unaffected - 7 and 14 days both preserve the
-- weekday exactly, which is why the other six listings are correct.
--
-- Fixing it properly means representing "first Tuesday of the month", which the
-- current recurrence_rule column ('weekly'/'biweekly'/'monthly') cannot express.
-- That is a schema and composer change, not a one-line constant, so it is
-- flagged rather than smuggled in here.
