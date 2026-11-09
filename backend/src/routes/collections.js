const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifySupabaseToken, requireAdmin } = require('../middleware/auth');

const { body, param, query, validationResult } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

/**
 * GET /collections
 * Public: list all collections
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ collections: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

/**
 * GET /collections/:id
 * Public: get a single collection
 */
router.get(
  '/:id',
  param('id').isUUID().withMessage('Invalid collection id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('collections')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Collection not found' });
      }
      return res.json({ collection: data });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

/**
 * POST /collections
 * Admin: create a collection
 * Body: { title, handle, description?, image_url? }
 */
router.post(
  '/',
  verifySupabaseToken,
  requireAdmin,
  [
    body('title').notEmpty().withMessage('title is required'),
    body('handle')
      .notEmpty()
      .withMessage('handle is required')
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage('handle must be a URL-friendly slug (e.g. summer-sale)'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { title, handle, description, image_url } = req.body;

      const { data, error } = await supabaseAdmin
        .from('collections')
        .insert({ title, handle, description, image_url })
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(201).json({ collection: data });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

/**
 * PUT /collections/:id
 * Admin: update a collection
 */
router.put(
  '/:id',
  verifySupabaseToken,
  requireAdmin,
  [
    param('id').isUUID().withMessage('Invalid collection id'),
    body('title').optional().notEmpty().withMessage('title cannot be empty'),
    body('handle')
      .optional()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage('handle must be a URL-friendly slug'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const updates = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.handle !== undefined) updates.handle = req.body.handle;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.image_url !== undefined) updates.image_url = req.body.image_url;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('collections')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Collection not found' });
      }
      return res.json({ collection: data });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

/**
 * DELETE /collections/:id
 * Admin: delete a collection
 */
router.delete(
  '/:id',
  verifySupabaseToken,
  requireAdmin,
  param('id').isUUID().withMessage('Invalid collection id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { error } = await supabaseAdmin.from('collections').delete().eq('id', req.params.id);

      if (error) {
        return res.status(404).json({ error: 'Collection not found' });
      }
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

module.exports = router;
