## Social Media Planner Module

A new top-level section in the app (sidebar entry: "Social Planner") for dealership staff to plan, script, score, and track social content across TikTok / Facebook / Instagram / YouTube Shorts / Reels. Plan-only for now — posts are tracked internally, not published to external APIs.

### Routes & pages
- `/social` — Planner dashboard (overview cards + today's queue)
- `/social/calendar` — Weekly/monthly calendar of scheduled posts
- `/social/posts` — List view of all posts with filters (platform, status, vehicle, assignee)
- `/social/posts/new` and `/social/posts/:id` — Create/edit post (dialog-based, matching the intake/cleaning pattern)
- `/social/scripts` — Library of walkaround scripts (template + per-vehicle)
- `/social/analytics` — Performance tracking + AI scoring leaderboard
- `/social/team` — Team accountability view (posts per user, completion rate)

### Sidebar
Add "Social Planner" group in `AppSidebar.tsx` with sub-items: Dashboard, Calendar, Posts, Scripts, Analytics, Team. Gated by role (admin + new `social_manager` role, plus any user can see their own assigned posts).

### Database (new tables, all in `public` with grants + RLS)

1. **`social_posts`** — id, vehicle_id (nullable FK to `bikes` — repurposed as "stock item"; nullable so generic posts allowed), title, caption, hook, hashtags (text[]), platforms (text[] — tiktok/facebook/instagram/youtube/reels), status (`draft|scheduled|posted|archived`), scheduled_at, posted_at, assigned_to (FK profiles), created_by, video_url (nullable, uses existing storage), thumbnail_url, script_id (nullable FK), created_at, updated_at.
2. **`social_scripts`** — id, name, category (`walkaround|feature|testimonial|promo`), body (markdown), variables (jsonb — placeholders like `{make}`, `{model}`), is_template (bool), created_by, created_at, updated_at.
3. **`social_post_scores`** — id, post_id FK, hook_score (0-10), retention_score, cta_score, production_score, overall_score (generated), notes, scored_by, scored_at. Allows manual scoring now; AI scoring stub can populate later via edge function.
4. **`social_post_metrics`** — id, post_id FK, platform, views, likes, comments, shares, saves, recorded_at. Manually entered for now (or via future platform integrations).
5. **`social_post_checklist`** — id, post_id FK, item (`filmed|edited|caption_written|approved|posted`), done (bool), done_by, done_at. Drives the "daily posting system" progress bar.

RLS: any authenticated user can read/insert; only assignee, creator, or admin/social_manager can update/delete. Add `social_manager` to existing `user_role` enum.

### Components
- `SocialSidebarSection` (added to `AppSidebar.tsx`)
- `pages/social/SocialDashboard.tsx` — KPI cards (posts this week, completion rate, top-scoring post, untouched vehicles)
- `pages/social/SocialCalendar.tsx` — month/week grid, click day to schedule
- `pages/social/SocialPostsPage.tsx` — list + filters
- `components/social/PostForm.tsx` — dialog form (vehicle select, platforms multi-select, scheduled_at, script picker, video upload, hashtags, caption)
- `components/social/PostDetailView.tsx` — opened in dialog from list/calendar (matches intake/cleaning UX)
- `components/social/ScriptLibrary.tsx` + `ScriptForm.tsx`
- `components/social/ScoreCard.tsx` — manual scoring form with sliders
- `components/social/MetricsForm.tsx` — manual entry per platform
- `components/social/PostChecklist.tsx` — checklist toggles
- `components/social/AnalyticsView.tsx` — recharts: posts over time, avg score per user, top posts

### Storage
Reuse the existing pattern; add a new public bucket `social-media` for video/thumbnail uploads (via migration).

### Out of scope (explicit)
- Real publishing to TikTok / Meta / YouTube APIs
- Automated AI video scoring (stub the table; AI scoring can be added later via Lovable AI Gateway)
- Real-time metric pulls from platforms

### Implementation order
1. Migration: enum value + 5 tables + bucket + RLS + grants
2. Sidebar entry + routes wired in `App.tsx`
3. Posts list + PostForm + PostDetailView (dialog)
4. Calendar
5. Scripts library
6. Dashboard, Analytics, Team views
7. Scoring + checklist + metrics sub-components