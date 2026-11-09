const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabaseAdmin } = require('../config/supabase');
const { verifySupabaseToken, requireAdmin } = require('../middleware/auth');

const BUCKET_PRODUCTS = process.env.STORAGE_BUCKET_PRODUCTS || 'product-images';
const BUCKET_COLLECTIONS = process.env.STORAGE_BUCKET_COLLECTIONS || 'collection-images';

// Memory storage so we can stream the buffer directly to Supabase Storage
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * POST /upload
 * Admin: upload a file to Supabase Storage
 * Form: file (file), bucket ('product-images' | 'collection-images'), path (optional folder/prefix)
 */
router.post(
  '/',
  verifySupabaseToken,
  requireAdmin,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

      const bucket = req.body.bucket || BUCKET_PRODUCTS;
      if (![BUCKET_PRODUCTS, BUCKET_COLLECTIONS].includes(bucket)) {
        return res.status(400).json({ error: 'Invalid bucket' });
      }

      const folder = (req.body.path || '').replace(/\/+$/, '');
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const storagePath = folder ? `${folder}/${fileName}` : fileName;

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        return res.status(500).json({ error: error.message });
    }

      const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);

      return res.status(201).json({
        path: data.path,
        full_path: data.fullPath,
        bucket: data.bucketId,
        public_url: urlData.publicUrl,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

/**
 * DELETE /upload/:bucket/:path*
 * Admin: delete a file from Supabase Storage
 */
router.delete(
  '/:bucket/:path*',
  verifySupabaseToken,
  requireAdmin,
  async (req, res) => {
    try {
      const bucket = req.params.bucket;
      if (![BUCKET_PRODUCTS, BUCKET_COLLECTIONS].includes(bucket)) {
        return res.status(400).json({ error: 'Invalid bucket' });
      }

      const filePath = req.params.path ? req.params.path.join('/') : '';
      if (!filePath) {
        return res.status(400).json({ error: 'No file path provided' });
      }

      const { error } = await supabaseAdmin.storage.from(bucket).remove([filePath]);

      if (error) {
        return res.status(500).json({ error: error.message });
    }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
);

module.exports = router;
