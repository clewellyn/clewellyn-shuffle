#!/usr/bin/env node
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import handler from './api/videos.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static site files from repo root
app.use(express.static(__dirname));

// Mount the API route using the existing handler
app.get('/api/videos', (req, res) => handler(req, res));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
