## Fix `owner_check` constraint to allow investor bikes

The `bikes.owner_check` constraint currently allows both `owner_id` and `external_owner_id` to be null **only when `source = 'owned'`**. Investor bikes have no owner either, but `source = 'investor'`, so the insert fails.

### Migration
Drop and re-add `owner_check` to also permit `source = 'investor'` with both owner fields null:

```sql
ALTER TABLE public.bikes DROP CONSTRAINT owner_check;
ALTER TABLE public.bikes ADD CONSTRAINT owner_check CHECK (
  (owner_id IS NOT NULL AND external_owner_id IS NULL)
  OR (owner_id IS NULL AND external_owner_id IS NOT NULL)
  OR (owner_id IS NULL AND external_owner_id IS NULL AND source IN ('owned', 'investor'))
);
```

No code changes needed.
