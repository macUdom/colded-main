require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const collectionRoutes = require('./routes/collections');
const productRoutes = require('./routes/products');
const uploadRoutes = require('./routes/upload');

const app = express();

const PORT = process.env.PORT || 10000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Trust proxy (Render sits behind a load balancer)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root route - convenience health/info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ColdEx Ecommerce Backend',
    status: 'ok',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth',
      products: '/products',
      collections: '/collections',
      upload: '/upload',
    },
  });
});

// Health check (Render uses this for health checks)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'colded-ecommerce-backend', time: new Date().toISOString() });
});

// API routes
app.use('/auth', authRoutes);
app.use('/collections', collectionRoutes);
app.use('/products', productRoutes);
app.use('/upload', uploadRoutes);

// Serve static frontend build (after npm run build in root)
const path = require('path');
const fs = require('fs');
const distPath = path.join(__dirname, '..', '..', 'dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // Catch-all: serve index.html for non-API routes (SPA fallback)
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // 404 if no build exists
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cooled ecommerce backend listening on http://0.0.0.0:${PORT}`);
});

module.exports = app;
