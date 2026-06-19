import dotenv from 'dotenv';
dotenv.config();

// In-memory queue of simulated emails sent during execution
const simulatedEmails = [];

export function getSimulatedEmails() {
  return simulatedEmails;
}

export function clearSimulatedEmails() {
  simulatedEmails.length = 0;
}

/**
 * Generates a premium HTML email template inspired by the Supercell ID layout.
 */
export function generateSupercellEmailHtml({ title, bodyText, code, footerText }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .wrapper {
          width: 100%;
          background-color: #f3f4f6;
          padding: 30px 0;
        }
        .container {
          max-width: 540px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          border: 1px solid #e5e7eb;
        }
        .header {
          background-color: #111827;
          padding: 24px;
          text-align: center;
          border-bottom: 3px solid #dc2626;
        }
        .logo-text {
          font-size: 22px;
          font-weight: 900;
          font-style: italic;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #ffffff;
        }
        .logo-accent {
          color: #ef4444;
        }
        .logo-badge {
          background-color: #ef4444;
          color: #ffffff;
          padding: 2px 6px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: bold;
          vertical-align: middle;
          margin-left: 6px;
          font-style: normal;
          letter-spacing: normal;
        }
        .content {
          padding: 40px 32px;
          text-align: center;
        }
        .illustration-box {
          margin-bottom: 24px;
          display: inline-block;
          padding: 16px;
          background-color: #fef2f2;
          border-radius: 50%;
        }
        .headline {
          font-size: 24px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 16px;
          text-transform: capitalize;
        }
        .message-body {
          font-size: 14px;
          color: #4b5563;
          line-height: 1.6;
          margin-bottom: 30px;
          font-weight: 500;
        }
        .code-display {
          background-color: #f9fafb;
          border: 2px dashed #d1d5db;
          border-radius: 16px;
          padding: 18px 24px;
          font-size: 32px;
          font-weight: 800;
          color: #111827;
          letter-spacing: 8px;
          text-indent: 8px;
          font-family: "SF Mono", SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
          display: inline-block;
          margin-bottom: 30px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }
        .footer {
          padding: 24px;
          background-color: #f9fafb;
          border-top: 1px solid #f3f4f6;
          text-align: center;
          font-size: 11px;
          color: #9ca3af;
          line-height: 1.5;
        }
        .footer-brand {
          margin-top: 8px;
          font-weight: bold;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <span class="logo-text">HONTECH<span class="logo-accent">CENTER</span><span class="logo-badge">SECURE</span></span>
          </div>
          <div class="content">
            <div class="illustration-box">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 11 2 2 4-4"/>
              </svg>
            </div>
            <div class="headline">${title}</div>
            <div class="message-body">${bodyText}</div>
            ${code ? `<div class="code-display">${code}</div>` : ''}
          </div>
          <div class="footer">
            ${footerText || 'This security verification code was generated to secure your HonTech system login credentials. Do not share this code with anyone.'}
            <div class="footer-brand">© 2026 HonTech AutoCenter Inc.</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendEmail({ to, subject, text, html }) {
  const id = 'mail_' + Math.random().toString(36).substring(2, 9);
  const finalHtml = html || generateSupercellEmailHtml({ title: subject, bodyText: text, code: null });

  // Add to in-memory queue
  simulatedEmails.push({
    id,
    to,
    subject,
    text,
    html: finalHtml,
    timestamp: new Date(),
    read: false
  });

  // Keep simulated email queue size bounded
  if (simulatedEmails.length > 50) {
    simulatedEmails.shift();
  }

  console.log(`\n==================================================`);
  console.log(`[OUTGOING EMAIL (ID: ${id})]`);
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Content: ${text}`);
  console.log(`==================================================\n`);

  // Try to use nodemailer dynamically if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"HonTech Security" <security@hontech.com>',
        to,
        subject,
        text,
        html: finalHtml
      });

      console.log(`[SMTP Email Sent] Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(`[SMTP Email Error] Failed to send email via SMTP:`, error.message);
      return false;
    }
  }

  return true;
}

