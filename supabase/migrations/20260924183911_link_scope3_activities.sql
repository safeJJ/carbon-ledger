-- Connect Scope 3 inventory rows with the category used in the assessment.
-- Nullable so existing inventories and older clients continue to work.
alter table public.activities add column scope3_category text;

alter table public.activities add constraint activities_scope3_category_check
  check (
    (scope = 3 or scope3_category is null)
    and (scope3_category is null or length(scope3_category) between 1 and 150)
  );

comment on column public.activities.scope3_category is
  'Optional Scope 3 category; existing activities remain unchanged.';
