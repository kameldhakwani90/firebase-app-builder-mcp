#!/usr/bin/env node

/**
 * Version super minimale - juste Express
 */

const express = require('express');

console.log('🚀 Démarrage super minimal...');

const app = express();

app.use(express.json());

app.get('/api/projects', (req, res) => {
  console.log('📊 GET /api/projects');
  res.json([]);
});

app.post('/api/analyze', (req, res) => {
  console.log('📊 POST /api/analyze:', req.body?.github_url);
  
  res.json({
    project_id: `project_${Date.now()}`,
    github_url: req.body?.github_url,
    status: 'analyzed',
    business_type: 'e-commerce'
  });
});

const server = app.listen(3002, () => {
  console.log('✅ Super minimal: http://localhost:3002');
});

process.on('SIGINT', () => {
  console.log('🛑 Arrêt...');
  server.close(() => {
    process.exit(0);
  });
});