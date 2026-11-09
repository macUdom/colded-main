const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifySupabaseToken, requireAdmin, getCallerProfile } = require('../middleware/auth');

/**
 * POST /auth/signup
 * Body: { email, password, role? }
 * Creates a Supabase Auth user + matching profile.
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: role || 'customer' },
    });

    if (error || !data.user) {
      return res.status(400).json({ error: error ? error.message : 'Failed to create user' });
    }

    // Create matching profile row
    await supabaseAdmin.from('profiles').insert({
      id: data.user.id,
      email,
      role: role || 'customer',
    });

    return res.status(201).json({
      user: { id: data.user.id, email: data.user.email, role: role || 'customer' },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

/**
 * POST /auth/login
 * Body: { email, password }
 * Returns Supabase session (access_token + refresh_token).
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return res.status(401).json({ error: error ? error.message : 'Invalid credentials' });
    }

    const profile = await getCallerProfile(data.user.id);

    return res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email, role: profile ? profile.role : 'customer' },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

/**
 * GET /auth/me
 * Returns the caller's profile (requires auth).
 */
router.get('/me', verifySupabaseToken, async (req, res) => {
  const profile = await getCallerProfile(req.user.id);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  return res.json({ user: profile });
});

/**
 * POST /auth/admin
 * Body: { userId }
 * Promote a user to admin (admin-only).
 */
router.post('/admin', verifySupabaseToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'admin', updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ success: true, message: `User ${userId} promoted to admin` });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
