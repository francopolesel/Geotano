import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_ADDRESS = process.env.SMTP_FROM || SMTP_USER;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

export async function sendPasswordResetEmail(
  to: string,
  newPassword: string,
): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: `"Geotano" <${FROM_ADDRESS}>`,
    to,
    subject: 'Your Geotano password has been reset',
    text: `Hello,

We received a request to reset your Geotano password.

Your new temporary password is:

  ${newPassword}

Please log in with this password and change it from the Settings page.

If you did not request this, please ignore this email — your account is safe.

— The Geotano Team`,
    html: `<p>Hello,</p>
<p>We received a request to reset your Geotano password.</p>
<p>Your new temporary password is:</p>
<pre style="font-size:16px;background:#f4f4f4;padding:12px;border-radius:6px;">${newPassword}</pre>
<p>Please log in with this password and change it from the <strong>Settings</strong> page.</p>
<p>If you did not request this, please ignore this email — your account is safe.</p>
<p>— The Geotano Team</p>`,
  });
}
