-- ============================================
-- Backfill profiles for auth users created before the profiles table and its trigger existed
-- (for example admins who signed in with Google before the first migration reached production).
-- Uses the same rule as handle_new_user: admin emails get 'admin', everyone else 'pending'.
-- ============================================
INSERT INTO profiles (id, email, full_name, role)
SELECT
  u.id,
  lower(u.email),
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  CASE
    WHEN EXISTS (SELECT 1 FROM admin_emails a WHERE lower(a.email) = lower(u.email)) THEN 'admin'
    ELSE 'pending'
  END
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);
