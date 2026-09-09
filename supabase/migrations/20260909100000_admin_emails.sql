-- ============================================
-- Additional admin account, and promote any of the admin emails that already signed up as pending.
-- The signup trigger only assigns 'admin' at creation time, so existing profiles need the update.
-- ============================================
INSERT INTO admin_emails (email) VALUES ('microsaasjyap@gmail.com')
ON CONFLICT (email) DO NOTHING;

UPDATE profiles p
   SET role = 'admin'
 WHERE p.role <> 'admin'
   AND EXISTS (SELECT 1 FROM admin_emails a WHERE lower(a.email) = lower(p.email));
