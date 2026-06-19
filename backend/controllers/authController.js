import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { verifyTOTP, generateBase32Secret, generateBackupCodes } from '../config/securityUtils.js';
import { sendEmail, generateSupercellEmailHtml } from '../config/emailUtils.js';

const generateToken = (res, userId, role) => {
  const token = jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'supersecretjwtkey12345!',
    { expiresIn: '1d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated.' });
    }

    // Check if user has MFA enabled
    if (user.mfaEnabled) {
      return res.status(200).json({
        requiresMfa: true,
        userId: user._id,
        email: user.email
      });
    }

    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    generateToken(res, user._id, user.role);

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
};

export const verifyMfa = async (req, res) => {
  const { userId, mfaCode } = req.body;

  try {
    if (!userId || !mfaCode) {
      return res.status(400).json({ message: 'User ID and MFA code are required.' });
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User account not found or deactivated.' });
    }

    let isCodeValid = false;

    // 1. Verify TOTP Code if secret exists
    if (user.mfaSecret) {
      isCodeValid = verifyTOTP(user.mfaSecret, mfaCode);
    }

    // 2. Fallback to Backup Codes if TOTP failed
    if (!isCodeValid && user.backupCodes && user.backupCodes.length > 0) {
      const codeUpper = mfaCode.trim().toUpperCase();
      for (let i = 0; i < user.backupCodes.length; i++) {
        const match = await bcrypt.compare(codeUpper, user.backupCodes[i]);
        if (match) {
          isCodeValid = true;
          // Consume this single-use backup code
          user.backupCodes.splice(i, 1);
          await user.save();
          break;
        }
      }
    }

    if (!isCodeValid) {
      return res.status(401).json({ message: 'Invalid MFA verification code.' });
    }

    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    generateToken(res, user._id, user.role);

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during MFA verification.', error: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey12345!');
        await User.findByIdAndUpdate(decoded.id, { isOnline: false });
      } catch (err) {
        // Ignore error
      }
    }
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.status(200).json({ message: 'Successfully logged out.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during logout.', error: error.message });
  }
};

export const pingActiveSession = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: true,
      lastActive: new Date()
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error during ping.', error: error.message });
  }
};

export const getMe = async (req, res) => {
  res.status(200).json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    backupEmail: req.user.backupEmail,
    mfaEnabled: req.user.mfaEnabled,
    googleLinked: !!req.user.googleId,
    googleEmail: req.user.googleEmail
  });
};

export const getStaff = async (req, res) => {
  try {
    const staff = await User.find({}).select('-password');
    res.status(200).json(staff);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving staff roster.', error: error.message });
  }
};

export const createStaff = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    const newStaff = new User({
      name,
      email,
      password,
      role
    });

    await newStaff.save();

    res.status(201).json({
      id: newStaff._id,
      name: newStaff.name,
      email: newStaff.email,
      role: newStaff.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating staff account.', error: error.message });
  }
};

export const deleteStaff = async (req, res) => {
  const { id } = req.params;

  try {
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({ message: 'Staff member not found.' });
    }

    // Safeguard: Cannot delete the primary owner
    if (userToDelete.role === 'owner' && userToDelete.email === 'owner@hontech.com') {
      return res.status(400).json({ message: 'Cannot remove the primary System Admin account.' });
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ message: 'Staff access successfully revoked.' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing staff account.', error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const targetEmail = email.toLowerCase().trim();
    // Search by primary email OR verified backup recovery email
    const user = await User.findOne({
      $or: [
        { email: targetEmail },
        { backupEmail: targetEmail }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'No user found with that email address.' });
    }

    // Generate 6-digit OTP code for password reset
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordToken = otp;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // valid for 15 minutes
    await user.save();

    console.log(`[PASSWORD RESET OTP] for ${targetEmail}: ${otp}`);

    await sendEmail({
      to: targetEmail,
      subject: 'HonTech Security: Password Reset Request',
      text: `Your password reset code is: ${otp}. It is valid for 15 minutes.`,
      html: generateSupercellEmailHtml({
        title: 'Password Reset Request',
        bodyText: `We received a request to reset your password. Please use the following 6-digit verification code to complete the password reset process:`,
        code: otp,
        footerText: 'This verification code is valid for 15 minutes. If you did not request a password reset, you can safely ignore this email.'
      })
    });

    res.status(200).json({
      message: `A password reset code has been sent. For testing, the code is: ${otp}`,
      token: otp
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during forgot password.', error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;

  try {
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: 'Email, code, and new password are required.' });
    }

    const targetEmail = email.toLowerCase().trim();
    const user = await User.findOne({
      $or: [
        { email: targetEmail },
        { backupEmail: targetEmail }
      ],
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset code.' });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been successfully reset.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during password reset.', error: error.message });
  }
};

// --- PROFILE MANAGEMENT & SECURITY CONTROLS ---

export const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during password update.', error: error.message });
  }
};

export const requestEmailChange = async (req, res) => {
  const { password, newEmail } = req.body;

  try {
    if (!password || !newEmail) {
      return res.status(400).json({ message: 'Password and new email are required.' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password.' });
    }

    const targetEmail = newEmail.toLowerCase().trim();
    const emailExists = await User.findOne({ email: targetEmail });
    if (emailExists) {
      return res.status(400).json({ message: 'This email is already registered.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.newEmailPending = targetEmail;
    user.newEmailOTP = otp;
    user.newEmailOTPExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    console.log(`[EMAIL CHANGE OTP] for ${targetEmail}: ${otp}`);

    await sendEmail({
      to: targetEmail,
      subject: 'HonTech Security: Verify Your New Email Address',
      text: `Your email change verification code is: ${otp}.`,
      html: generateSupercellEmailHtml({
        title: 'Verify New Email Address',
        bodyText: `Please enter the verification code below in your profile dashboard to verify and update your primary email address to ${targetEmail}:`,
        code: otp,
        footerText: 'This email change verification code is valid for 15 minutes. If you did not request this update, please ignore this email.'
      })
    });

    res.status(200).json({
      message: `A verification code has been sent. For testing, the code is: ${otp}`,
      token: otp
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error requesting email change.', error: error.message });
  }
};

export const verifyEmailChange = async (req, res) => {
  const { otp } = req.body;

  try {
    if (!otp) {
      return res.status(400).json({ message: 'Verification OTP code is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user.newEmailPending || !user.newEmailOTP || user.newEmailOTP !== otp || user.newEmailOTPExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired verification code.' });
    }

    user.email = user.newEmailPending;
    user.newEmailPending = undefined;
    user.newEmailOTP = undefined;
    user.newEmailOTPExpires = undefined;
    await user.save();

    res.status(200).json({
      message: 'Primary email address verified and updated successfully.',
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error verifying email change.', error: error.message });
  }
};

export const requestBackupEmail = async (req, res) => {
  const { password, backupEmail } = req.body;

  try {
    if (!password || !backupEmail) {
      return res.status(400).json({ message: 'Password and backup recovery email are required.' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password.' });
    }

    const targetEmail = backupEmail.toLowerCase().trim();
    if (targetEmail === user.email) {
      return res.status(400).json({ message: 'Backup recovery email must be different from your primary email.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.backupEmailOTP = otp;
    user.backupEmailOTPExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    console.log(`[BACKUP EMAIL OTP] for ${targetEmail}: ${otp}`);

    await sendEmail({
      to: targetEmail,
      subject: 'HonTech Security: Verify Backup Recovery Email',
      text: `Your backup email verification code is: ${otp}.`,
      html: generateSupercellEmailHtml({
        title: 'Verify Backup Recovery Email',
        bodyText: `Please enter the verification code below to verify and link this email address as your secondary backup recovery email:`,
        code: otp,
        footerText: 'This backup recovery verification code is valid for 15 minutes. If you did not initiate this configuration, please secure your account.'
      })
    });

    res.status(200).json({
      message: `A verification code has been sent. For testing, the code is: ${otp}`,
      token: otp
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error requesting backup email.', error: error.message });
  }
};

export const verifyBackupEmail = async (req, res) => {
  const { otp, backupEmail } = req.body;

  try {
    if (!otp || !backupEmail) {
      return res.status(400).json({ message: 'OTP code and backup email are required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user.backupEmailOTP || user.backupEmailOTP !== otp || user.backupEmailOTPExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired verification code.' });
    }

    user.backupEmail = backupEmail.toLowerCase().trim();
    user.backupEmailOTP = undefined;
    user.backupEmailOTPExpires = undefined;
    await user.save();

    res.status(200).json({
      message: 'Backup recovery email verified and linked successfully.',
      backupEmail: user.backupEmail
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error verifying backup email.', error: error.message });
  }
};

export const setupMfa = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const secret = generateBase32Secret();
    user.mfaSecret = secret;
    await user.save();

    const label = `HonTech:${user.email}`;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=HonTech`;
    
    // We use a public QR code generation API.
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;

    res.status(200).json({
      secret,
      qrCodeUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error setting up MFA.', error: error.message });
  }
};

export const enableMfa = async (req, res) => {
  const { otpCode } = req.body;

  try {
    if (!otpCode) {
      return res.status(400).json({ message: 'OTP code is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user.mfaSecret) {
      return res.status(400).json({ message: 'MFA setup not initiated. Please request MFA secret first.' });
    }

    const isValid = verifyTOTP(user.mfaSecret, otpCode);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid MFA verification code.' });
    }

    user.mfaEnabled = true;

    // Generate 8 alphanumeric backup codes
    const rawCodes = generateBackupCodes(8);
    const hashedCodes = await Promise.all(
      rawCodes.map(code => bcrypt.hash(code, 10))
    );

    user.backupCodes = hashedCodes;
    await user.save();

    res.status(200).json({
      message: 'Multi-Factor Authentication activated successfully.',
      backupCodes: rawCodes
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error enabling MFA.', error: error.message });
  }
};

export const disableMfa = async (req, res) => {
  const { password } = req.body;

  try {
    if (!password) {
      return res.status(400).json({ message: 'Password is required to disable MFA.' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password.' });
    }

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.backupCodes = [];
    await user.save();

    res.status(200).json({ message: 'Multi-Factor Authentication disabled.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error disabling MFA.', error: error.message });
  }
};

export const googleLink = async (req, res) => {
  const { googleEmail, googleId } = req.body;

  try {
    if (!googleEmail) {
      return res.status(400).json({ message: 'Google email is required.' });
    }

    const user = await User.findById(req.user._id);
    const targetEmail = googleEmail.toLowerCase().trim();

    // Check if another account has already linked this Google ID/Email
    const duplicate = await User.findOne({ googleEmail: targetEmail });
    if (duplicate && duplicate._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'This Google account is already linked to another user.' });
    }

    user.googleEmail = targetEmail;
    user.googleId = googleId || `g_${Math.floor(10000000 + Math.random() * 90000000)}`;
    await user.save();

    res.status(200).json({
      message: 'Google account linked successfully.',
      googleEmail: user.googleEmail
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error linking Google account.', error: error.message });
  }
};

export const googleUnlink = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.googleEmail = undefined;
    user.googleId = undefined;
    await user.save();

    res.status(200).json({ message: 'Google account unlinked successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error unlinking Google account.', error: error.message });
  }
};

export const googleLogin = async (req, res) => {
  const { googleEmail } = req.body;

  try {
    if (!googleEmail) {
      return res.status(400).json({ message: 'Google email is required.' });
    }

    const targetEmail = googleEmail.toLowerCase().trim();
    // Search by linked Google Email or primary email
    let user = await User.findOne({
      $or: [
        { googleEmail: targetEmail },
        { email: targetEmail }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'Google login failed. No user found with this Google account.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated.' });
    }

    // Auto-link Google email if not set but matches primary
    if (!user.googleEmail) {
      user.googleEmail = targetEmail;
      user.googleId = user.googleId || `g_${Math.floor(10000000 + Math.random() * 90000000)}`;
    }

    if (user.mfaEnabled) {
      await user.save();
      return res.status(200).json({
        requiresMfa: true,
        userId: user._id,
        email: user.email
      });
    }

    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    generateToken(res, user._id, user.role);

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during Google Login.', error: error.message });
  }
};

export const resetStaffPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Personnel account not found.' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: `Password for ${user.name} has been reset successfully.` });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting personnel password.', error: error.message });
  }
};

export const toggleStaffActiveStatus = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Personnel account not found.' });
    }

    if (user.role === 'owner' && user.email === 'owner@hontech.com') {
      return res.status(400).json({ message: 'Cannot deactivate the primary System Owner account.' });
    }

    user.isActive = isActive;
    await user.save();

    res.status(200).json({
      message: `Personnel account access ${isActive ? 'restored' : 'suspended'}.`,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating personnel active status.', error: error.message });
  }
};

export const updateStaffRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    if (!role) {
      return res.status(400).json({ message: 'Role is required.' });
    }

    const validRoles = ['owner', 'assistant', 'sa'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role type.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Staff member not found.' });
    }

    // Safety check: Cannot change primary owner's role
    if (user.role === 'owner' && user.email === 'owner@hontech.com') {
      return res.status(400).json({ message: 'Cannot demote the primary System Admin.' });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      message: `Role for ${user.name} updated to ${role} successfully.`,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating staff role.', error: error.message });
  }
};
