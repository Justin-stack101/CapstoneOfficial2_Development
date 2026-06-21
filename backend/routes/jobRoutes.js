import express from 'express';
import { getJobs, createJob, updateJobField, setJobStatus, deleteJob, uploadTempFile, downloadTempFile, getAnalyticsData } from '../controllers/jobController.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public endpoint for temporary file downloading (requires high-entropy fileId, deletes immediately on use)
router.get('/export-download/:fileId', downloadTempFile);

// All other job operations require authentication
router.use(authenticateUser);

// Retrieve all jobs (all roles can view jobs/queues)
router.get('/', getJobs);

// Retrieve jobs for analytics/reports (Owner only)
router.get('/analytics', requireRole(['owner']), getAnalyticsData);

// Create new job intake (Assistant or Service Advisor only)
router.post('/', requireRole(['assistant', 'sa']), createJob);

// Update specific fields of a job (e.g. remarks, parts, evaluation)
router.patch('/:id/field', updateJobField);

// Update status and lift location
router.patch('/:id/status', setJobStatus);

// Delete job (Assistant only)
router.delete('/:id', requireRole(['assistant']), deleteJob);

// Server-side temporary staging routes for robust file naming
router.post('/export-temp', uploadTempFile);

export default router;
