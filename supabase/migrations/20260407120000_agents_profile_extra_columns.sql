-- Agent profile: age, years of experience, languages spoken (comma-separated labels)

alter table public.agents add column if not exists age integer;
alter table public.agents add column if not exists years_experience integer;
alter table public.agents add column if not exists languages_spoken text;

comment on column public.agents.age is 'Agent age (years), optional; 18–80 when set';
comment on column public.agents.years_experience is 'Years in real estate, optional; 0–50 when set';
comment on column public.agents.languages_spoken is 'Comma-separated language labels (e.g. English, Filipino)';

alter table public.agents drop constraint if exists agents_age_check;
alter table public.agents add constraint agents_age_check check (age is null or (age >= 18 and age <= 80));

alter table public.agents drop constraint if exists agents_years_experience_check;
alter table public.agents add constraint agents_years_experience_check check (
  years_experience is null or (years_experience >= 0 and years_experience <= 50)
);
