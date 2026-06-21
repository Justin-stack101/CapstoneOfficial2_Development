import express from 'express';
import {
  login,
  verifyMfa,
  logout,
  getMe,
  getStaff,
  createStaff,
  deleteStaff,
  forgotPassword,
  resetPassword,
  updatePassword,
  requestEmailChange,
  verifyEmailChange,
  requestBackupEmail,
  verifyBackupEmail,
  setupMfa,
  enableMfa,
  disableMfa,
  googleLink,
  googleUnlink,
  googleLogin,
  resetStaffPassword,
  toggleStaffActiveStatus,
  updateStaffRole,
  pingActiveSession
} from '../controllers/authController.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';
import { getSimulatedEmails, clearSimulatedEmails } from '../config/emailUtils.js';

const router = express.Router();

// Developer sandbox email simulator endpoints (Public/Developer helper routes)
router.get('/developer/emails', (req, res) => {
  res.status(200).json(getSimulatedEmails());
});
router.delete('/developer/emails', (req, res) => {
  clearSimulatedEmails();
  res.status(200).json({ message: 'Simulated email queue cleared.' });
});
router.patch('/developer/emails/:id/read', (req, res) => {
  const { id } = req.params;
  const emails = getSimulatedEmails();
  const mail = emails.find(e => e.id === id);
  if (mail) {
    mail.read = true;
  }
  res.status(200).json({ success: true });
});

// Public routes
router.post('/login', login);
router.post('/verify-mfa', verifyMfa);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google/login', googleLogin);

// Protected routes (any active authenticated user)
router.get('/me', authenticateUser, getMe);
router.post('/ping', authenticateUser, pingActiveSession);
router.put('/profile/password', authenticateUser, updatePassword);
router.post('/profile/email-change/request', authenticateUser, requestEmailChange);
router.post('/profile/email-change/verify', authenticateUser, verifyEmailChange);
router.post('/profile/backup-email/request', authenticateUser, requestBackupEmail);
router.post('/profile/backup-email/verify', authenticateUser, verifyBackupEmail);

// Multi-Factor Authentication (MFA) routes
router.post('/mfa/setup', authenticateUser, setupMfa);
router.post('/mfa/enable', authenticateUser, enableMfa);
router.post('/mfa/disable', authenticateUser, disableMfa);

// Google account linking
router.post('/google/link', authenticateUser, googleLink);
router.post('/google/unlink', authenticateUser, googleUnlink);

// Owner and Admin staff management routes
router.get('/staff', authenticateUser, requireRole(['owner', 'admin']), getStaff);
router.post('/staff', authenticateUser, requireRole(['admin']), createStaff);
router.delete('/staff/:id', authenticateUser, requireRole(['admin']), deleteStaff);
router.post('/staff/:id/reset-password', authenticateUser, requireRole(['admin']), resetStaffPassword);
router.patch('/staff/:id/toggle-active', authenticateUser, requireRole(['admin']), toggleStaffActiveStatus);
router.put('/staff/:id/role', authenticateUser, requireRole(['admin']), updateStaffRole);

export default router;
