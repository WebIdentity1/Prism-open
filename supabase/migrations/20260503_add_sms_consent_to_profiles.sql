-- Record SMS messaging consent at the profile level so we can prove
-- opt-in for transactional SMS (Twilio toll-free verification, CTIA, TCPA).
-- sms_consent_at  : timestamp the client checked the consent box (NULL = no consent on file)
-- sms_consent_text: exact disclosure text they agreed to, captured at consent time

alter table public.profiles
  add column if not exists sms_consent_at   timestamptz,
  add column if not exists sms_consent_text text;

create index if not exists idx_profiles_sms_consent_at
  on public.profiles (sms_consent_at)
  where sms_consent_at is not null;

comment on column public.profiles.sms_consent_at is
  'When the client gave SMS opt-in consent. NULL means no consent on file — do not send SMS.';
comment on column public.profiles.sms_consent_text is
  'Exact disclosure text the client agreed to. Stored verbatim for audit.';
