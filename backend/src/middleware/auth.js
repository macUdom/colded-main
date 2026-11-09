const { supabaseAdmin } = require('../config/supabase');

/**
 * Verify a Supabase JWT (access token) and return the authenticated user.
 * Expects token in Authorization: Bearer <token> header.
 */
async function verifySupabaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;
  next();
}

/**
 * Fetch the caller's profile from public.profiles.
 */
async function getCallerProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Middleware: require the caller to have the 'admin' role.
 */
async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const profile = await getCallerProfile(req.user.id);
  if (!profile || profile.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.profile = profile;
  next();
}

module.exports = { verifySupabaseToken, requireAdmin, getCallerProfile };
