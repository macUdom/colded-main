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
 * GET /products
 * Public: list products with optional filters
 * Query: collection_id, status, search, limit, offset
 */
router.get(
  '/',
  [
    query('collection_id').optional().isUUID().withMessage('Invalid collection_id'),
    query('status').optional().isIn(['draft', 'active', 'archived']).withMessage('Invalid status'),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('offset must be >= 0'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { collection_id, status, search, limit = 50, offset = 0 } = req.query;

      let qb = supabaseAdmin.from('products').select('*, collections(title, handle)');

      if (collection_id) qb = qb.eq('collection_id', collection_id);
      if (status) qb = qb.eq('status', status);
      if (search) {
        qb = qb.or(`title.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      qb = qb.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

      const { data, error, count } = await qb;

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ products: data || [], count });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

/**
 * GET /products/:id
 * Public: get a single product
 */
router.get(
  '/:id',
  param('id').isUUID().withMessage('Invalid product id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('*, collections(title, handle)')
        .eq('id', req.params.id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.json({ product: data });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

/**
 * POST /products
 * Admin: create a product
 * Body: { title, handle, description?, price, compare_at_price?, sku?, inventory_quantity?, collection_id?, image_url?, status? }
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
      .withMessage('handle must be a URL-friendly slug'),
    body('price')
      .isNumeric()
      .withMessage('price must be a number')
      .isFloat({ min: 0 })
      .withMessage('price must be >= 0'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        title,
        handle,
        description,
        price,
        compare_at_price,
        sku,
        inventory_quantity,
        collection_id,
        image_url,
        status,
      } = req.body;

      const { data, error } = await supabaseAdmin
        .from('products')
        .insert({
          title,
          handle,
          description,
          price: parseFloat(price),
          compare_at_price: compare_at_price ? parseFloat(compare_at_price) : null,
          sku,
          inventory_quantity: inventory_quantity ? parseInt(inventory_quantity, 10) : 0,
          collection_id,
          image_url,
          status: status || 'active',
        })
        .select('*, collections(title, handle)')
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(201).json({ product: data });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

/**
 * PUT /products/:id
 * Admin: update a product
 */
router.put(
  '/:id',
  verifySupabaseToken,
  requireAdmin,
  [
    param('id').isUUID().withMessage('Invalid product id'),
    body('price')
      .optional()
      .isNumeric()
      .withMessage('price must be a number')
      .isFloat({ min: 0 })
      .withMessage('price must be >= 0'),
    body('handle')
      .optional()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage('handle must be a URL-friendly slug'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const updates = {};
      const allowed = [
        'title',
        'handle',
        'description',
        'price',
        'compare_at_price',
        'sku',
        'inventory_quantity',
        'collection_id',
        'image_url',
        'status',
      ];
      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          updates[field] =
            field === 'price' || field === 'compare_at_price'
              ? parseFloat(req.body[field])
              : field === 'inventory_quantity'
              ? parseInt(req.body[field], 10)
              : req.body[field];
        }
      }
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('products')
        .update(updates)
        .eq('id', req.params.id)
        .select('*, collections(title, handle)')
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.json({ product: data });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

/**
 * DELETE /products/:id
 * Admin: delete a product
 */
router.delete(
  '/:id',
  verifySupabaseToken,
  requireAdmin,
  param('id').isUUID().withMessage('Invalid product id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { error } = await supabaseAdmin.from('products').delete().eq('id', req.params.id);

      if (error) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

module.exports = router;
