import crypto from 'crypto';

// Standard Base32 decoding for Google Authenticator secrets
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let binary = '';
  const cleanBase32 = base32.replace(/=+$/, '').toUpperCase();
  
  for (let i = 0; i < cleanBase32.length; i++) {
    const char = cleanBase32[i];
    const val = alphabet.indexOf(char);
    if (val === -1) continue; // skip invalid characters
    binary += val.toString(2).padStart(5, '0');
  }
  
  const bytes = [];
  for (let i = 0; i < binary.length; i += 8) {
    if (i + 8 <= binary.length) {
      bytes.push(parseInt(binary.slice(i, i + 8), 2));
    }
  }
  return Buffer.from(bytes);
}

// Generate a random Base32 secret for Google Authenticator (16 characters)
export function generateBase32Secret(length = 16) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    secret += alphabet[randomBytes[i] % alphabet.length];
  }
  return secret;
}

// Verify a 6-digit TOTP token against a Base32 secret with clock skew support (current, -30s, +30s)
export function verifyTOTP(secret, userToken) {
  if (!secret || !userToken) return false;
  
  const cleanToken = userToken.trim();
  const timeSteps = [0, -1, 1]; // Allow clock skew of 30 seconds before/after
  
  for (const step of timeSteps) {
    const counter = Math.floor(Date.now() / 1000 / 30) + step;
    
    // Write 64-bit counter to buffer
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(0, 0);
    buffer.writeUInt32BE(counter, 4);
    
    const key = base32Decode(secret);
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const hmacResult = hmac.digest();
    
    // Dynamic truncation
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const binary = ((hmacResult[offset] & 0x7f) << 24) |
                   ((hmacResult[offset + 1] & 0xff) << 16) |
                   ((hmacResult[offset + 2] & 0xff) << 8) |
                   (hmacResult[offset + 3] & 0xff);
                   
    const otp = (binary % 1000000).toString().padStart(6, '0');
    if (otp === cleanToken) return true;
  }
  
  return false;
}

// Generate a set of 8 random, numeric-alphabetic backup codes (8 characters each)
export function generateBackupCodes(count = 8) {
  const codes = [];
  const chars = '0123456789ABCDEF';
  for (let c = 0; c < count; c++) {
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    codes.push(code);
  }
  return codes;
}
