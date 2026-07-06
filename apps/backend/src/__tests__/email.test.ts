import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock nodemailer ─────────────────────────────────────────────────────────
const mockSendMail = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

// ─── Mock env ────────────────────────────────────────────────────────────────
const ORIGINAL_ENV = { ...process.env };

// We import dynamically so env is set before module code runs
async function importEmail() {
  return await import('../lib/email.js');
}

describe('email service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Clear module cache so each import() reads fresh env
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('should return false when SMTP is not configured', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const { isEmailConfigured } = await importEmail();
    expect(isEmailConfigured()).toBe(false);
  });

  it('should return true when SMTP is configured', async () => {
    process.env.SMTP_USER = 'test@geotano.app';
    process.env.SMTP_PASS = 'secret123';
    const { isEmailConfigured } = await importEmail();
    expect(isEmailConfigured()).toBe(true);
  });

  it('should create transporter lazily and reuse it', async () => {
    process.env.SMTP_USER = 'test@geotano.app';
    process.env.SMTP_PASS = 'secret123';

    // We'll call sendPasswordResetEmail, which internally calls getTransporter
    mockSendMail.mockResolvedValueOnce({ accepted: ['test@user.com'] });

    const { sendPasswordResetEmail } = await importEmail();
    await sendPasswordResetEmail('test@user.com', 'newPass123');

    // createTransport should be called once
    const nodemailer = await import('nodemailer');
    expect(nodemailer.default.createTransport).toHaveBeenCalledTimes(1);

    // Call again — should reuse same transporter
    mockSendMail.mockResolvedValueOnce({ accepted: ['test2@user.com'] });
    await sendPasswordResetEmail('test2@user.com', 'anotherPass');
    expect(nodemailer.default.createTransport).toHaveBeenCalledTimes(1);
  });

  it('should send password reset email with correct content', async () => {
    process.env.SMTP_USER = 'noreply@geotano.app';
    process.env.SMTP_PASS = 'secret123';

    mockSendMail.mockResolvedValueOnce({ accepted: ['user@test.com'] });

    const { sendPasswordResetEmail } = await importEmail();
    await sendPasswordResetEmail('user@test.com', 'TempPass456');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining('geotano.app'),
        to: 'user@test.com',
        subject: expect.stringContaining('password'),
        text: expect.stringContaining('TempPass456'),
        html: expect.stringContaining('TempPass456'),
      }),
    );
  });

  it('should propagate send error', async () => {
    process.env.SMTP_USER = 'test@geotano.app';
    process.env.SMTP_PASS = 'secret123';

    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

    const { sendPasswordResetEmail } = await importEmail();
    await expect(
      sendPasswordResetEmail('user@test.com', 'newPass'),
    ).rejects.toThrow('SMTP connection refused');
  });

  it('should use secure connection when SMTP_PORT is 465', async () => {
    process.env.SMTP_USER = 'test@geotano.app';
    process.env.SMTP_PASS = 'secret123';
    process.env.SMTP_PORT = '465';

    mockSendMail.mockResolvedValueOnce({ accepted: ['user@test.com'] });

    const { sendPasswordResetEmail } = await importEmail();
    await sendPasswordResetEmail('user@test.com', 'newPass');

    const nodemailer = await import('nodemailer');
    expect(nodemailer.default.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true }),
    );
  });

  it('should use SMTP_HOST env var when set', async () => {
    process.env.SMTP_USER = 'test@geotano.app';
    process.env.SMTP_PASS = 'secret123';
    process.env.SMTP_HOST = 'smtp.sendgrid.net';

    mockSendMail.mockResolvedValueOnce({ accepted: ['user@test.com'] });

    const { sendPasswordResetEmail } = await importEmail();
    await sendPasswordResetEmail('user@test.com', 'newPass');

    const nodemailer = await import('nodemailer');
    expect(nodemailer.default.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.sendgrid.net' }),
    );
  });
});
