import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { signToken, authGuard, hashPassword, verifyPassword } from '../auth/index.js';
import { eq, and, ne, or } from 'drizzle-orm';
import crypto from 'crypto';
import { isEmailConfigured, sendPasswordResetEmail } from '../lib/email.js';

function generateJoinCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

/** Map a DB user row to the API response shape. */
function mapUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    language: user.language,
    joinCode: user.joinCode,
    createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin?.toISOString?.(),
  };
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/api/auth/register', async (request, reply) => {
    const { username, email, password, displayName } = request.body as {
      username: string;
      email: string;
      password: string;
      displayName?: string;
    };

    if (!username || !email || !password) {
      return reply.status(400).send({ message: 'username, email, and password are required' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ message: 'Password must be at least 8 characters' });
    }

    // Check for existing user
    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({ message: 'Username or email already exists' });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
        displayName: displayName ?? username,
        joinCode: generateJoinCode(),
      })
      .returning();

    const token = signToken({ userId: user.id, username: user.username });

    return { token, user: mapUser(user) };
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body as {
      username: string;
      password: string;
    };

    if (!username || !password) {
      return reply.status(400).send({ message: 'username and password are required' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ message: 'Invalid username or password' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ message: 'Invalid username or password' });
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    const token = signToken({ userId: user.id, username: user.username });

    return { token, user: mapUser(user) };
  });

  // ── Google OAuth ──────────────────────────────────────────────────────────

  // POST /api/auth/google — login or register with Google ID token
  app.post('/api/auth/google', async (request, reply) => {
    const { credential, clientId } = request.body as {
      credential: string;
      clientId: string;
    };

    if (!credential) {
      return reply.status(400).send({ message: 'Google credential is required' });
    }

    // Verify the token with Google's tokeninfo endpoint
    let googlePayload: any;
    try {
      const resp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
      );
      if (!resp.ok) {
        return reply.status(401).send({ message: 'Invalid Google token' });
      }
      googlePayload = await resp.json();

      // Verify audience matches our client ID
      if (clientId && googlePayload.aud !== clientId) {
        return reply.status(401).send({ message: 'Token audience mismatch' });
      }
    } catch {
      return reply.status(401).send({ message: 'Failed to verify Google token' });
    }

    const googleId = googlePayload.sub;
    const email = googlePayload.email?.toLowerCase();
    const name = googlePayload.name || googlePayload.given_name || email?.split('@')[0] || 'user';
    const picture = googlePayload.picture;

    if (!email) {
      return reply.status(400).send({ message: 'Google account has no email' });
    }

    // Check if user exists by email
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      // Existing user — update last login and maybe avatar/picture
      const updates: any = { lastLogin: new Date() };
      if (picture && !user.avatarUrl) {
        updates.avatarUrl = picture;
      }
      await db.update(users).set(updates).where(eq(users.id, user.id));
    } else {
      // New user — register with Google info
      const usernameBase = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').slice(0, 20);
      let username = usernameBase;
      let suffix = 1;
      while (true) {
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);
        if (existing.length === 0) break;
        username = `${usernameBase}${suffix}`;
        suffix++;
      }

      [user] = await db
        .insert(users)
        .values({
          username,
          email,
          displayName: name,
          avatarUrl: picture ?? null,
          passwordHash: await hashPassword(crypto.randomBytes(24).toString('hex')),
          joinCode: generateJoinCode(),
        })
        .returning();
    }

    const token = signToken({ userId: user.id, username: user.username });
    return { token, user: mapUser(user) };
  });

  // ── Profile ───────────────────────────────────────────────────────────────

  // PATCH /api/auth/profile — update display name, avatar URL, language
  app.patch(
    '/api/auth/profile',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { displayName, avatarUrl, avatarData, language, username } = request.body as {
        displayName?: string;
        avatarUrl?: string;
        avatarData?: string;
        language?: string;
        username?: string;
      };

      const updates: Record<string, any> = {};
      if (displayName !== undefined) updates.displayName = displayName || null;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || null;
      if (avatarData !== undefined) {
        // Validate base64 image data URI
        if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(avatarData)) {
          return reply.status(400).send({ message: 'avatarData must be a valid base64 image (PNG, JPEG, WebP, or GIF)' });
        }
        // ~2 MB limit (base64 is ~33% larger than binary, so ~2.8 MB base64 ≈ 2 MB binary)
        if (avatarData.length > 2_800_000) {
          return reply.status(400).send({ message: 'Image must be smaller than 2 MB' });
        }
        updates.avatarUrl = avatarData;
      }
      if (language !== undefined) {
        if (!['en', 'es'].includes(language)) {
          return reply.status(400).send({ message: 'Language must be "en" or "es"' });
        }
        updates.language = language;
      }
      if (username !== undefined) {
        const trimmed = username.trim();
        if (trimmed.length < 3) {
          return reply.status(400).send({ message: 'Username must be at least 3 characters' });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
          return reply.status(400).send({ message: 'Username can only contain letters, numbers, and underscores' });
        }
        // Check uniqueness
        const [existing] = await db
          .select()
          .from(users)
          .where(and(eq(users.username, trimmed), ne(users.id, userId)))
          .limit(1);
        if (existing) {
          return reply.status(409).send({ message: 'Username already taken' });
        }
        updates.username = trimmed;
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ message: 'No fields to update' });
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, userId))
        .returning();

      return mapUser(updated);
    },
  );

  // POST /api/auth/change-password — change current password
  app.post(
    '/api/auth/change-password',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      if (!currentPassword || !newPassword) {
        return reply.status(400).send({ message: 'currentPassword and newPassword are required' });
      }

      if (newPassword.length < 8) {
        return reply.status(400).send({ message: 'New password must be at least 8 characters' });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ message: 'User not found' });
      }

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        return reply.status(400).send({ message: 'Current password is incorrect' });
      }

      const newHash = await hashPassword(newPassword);
      await db
        .update(users)
        .set({ passwordHash: newHash })
        .where(eq(users.id, userId));

      return { success: true };
    },
  );

  // POST /api/auth/forgot-password — send a new random password by email
  app.post('/api/auth/forgot-password', async (request, reply) => {
    const { email } = request.body as { email?: string };

    if (!email) {
      return reply.status(400).send({ message: 'Email is required' });
    }

    if (!isEmailConfigured()) {
      return reply.status(500).send({ message: 'Email service is not configured' });
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      // Don't reveal whether the email exists — security best practice
      return { message: 'If that email is registered, you will receive a new password shortly.' };
    }

    // Generate random password (16 chars, alphanumeric)
    const newPassword = crypto.randomBytes(12).toString('hex');

    // Hash and update
    const newHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    // Send email (fire-and-forget — don't fail the request on mail error)
    try {
      await sendPasswordResetEmail(email, newPassword);
    } catch (err) {
      console.error('Failed to send password reset email:', err);
      return reply.status(500).send({ message: 'Failed to send email. Please try again later.' });
    }

    return { message: 'If that email is registered, you will receive a new password shortly.' };
  });

  // GET /api/auth/me  (protected)
  app.get('/api/auth/me', { preHandler: authGuard }, async (request, reply) => {
    const { userId } = (request as any).user;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.status(404).send({ message: 'User not found' });
    }

    return mapUser(user);
  });
}
