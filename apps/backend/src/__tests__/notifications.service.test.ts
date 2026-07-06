import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB ────────────────────────────────────────────────────────────────
const waitData: any[] = [];

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  then(resolve: (value: any) => void) {
    const data = waitData.shift();
    resolve(data !== undefined ? data : []);
  },
  catch() {},
}));

vi.mock('../db/index.js', () => ({ db: mockDb }));

// ─── Mock socket ────────────────────────────────────────────────────────────
const mockIo = vi.hoisted(() => ({
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
}));

const mockGetIO = vi.hoisted(() => vi.fn());
const mockGetUserSocketIds = vi.hoisted(() => vi.fn());

vi.mock('../socket/index.js', () => ({
  getIO: mockGetIO,
  getUserSocketIds: mockGetUserSocketIds,
}));

import { createNotification } from '../services/notifications.js';

function setupMocks() {
  waitData.length = 0;
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockReturnThis();
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.delete.mockReturnThis();
}

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('should persist notification and emit to user sockets', async () => {
    mockGetUserSocketIds.mockReturnValue(['socket-1', 'socket-2']);
    mockGetIO.mockReturnValue(mockIo);

    // DB: insert → returning
    waitData.push([{
      id: 'notif-1',
      userId: 'user-2',
      type: 'friend_request',
      fromUserId: 'user-1',
      metadata: null,
      read: false,
      createdAt: new Date('2026-07-06T12:00:00Z'),
    }]);
    // DB: select sender profile
    waitData.push([{
      id: 'user-1',
      username: 'sender',
      displayName: 'Sender',
      avatarUrl: null,
    }]);

    const result = await createNotification({
      userId: 'user-2',
      type: 'friend_request',
      fromUserId: 'user-1',
    });

    expect(result.id).toBe('notif-1');
    expect(result.fromUsername).toBe('sender');
    expect(result.fromDisplayName).toBe('Sender');

    // Should emit to BOTH sockets
    expect(mockIo.to).toHaveBeenCalledWith('socket-1');
    expect(mockIo.to).toHaveBeenCalledWith('socket-2');
    expect(mockIo.emit).toHaveBeenCalledTimes(2);
    expect(mockIo.emit).toHaveBeenCalledWith('notification:new', expect.objectContaining({
      notification: expect.objectContaining({ id: 'notif-1' }),
    }));
  });

  it('should handle getIO throwing (socket not initialized)', async () => {
    mockGetIO.mockImplementation(() => { throw new Error('Socket not ready'); });

    waitData.push([{
      id: 'notif-2',
      userId: 'user-2',
      type: 'friend_request',
      fromUserId: 'user-1',
      metadata: null,
      read: false,
      createdAt: new Date('2026-07-06T12:00:00Z'),
    }]);
    waitData.push([{
      id: 'user-1', username: 'sender', displayName: 'Sender', avatarUrl: null,
    }]);

    // Should NOT throw — catch block handles it silently
    const result = await createNotification({
      userId: 'user-2',
      type: 'friend_request',
      fromUserId: 'user-1',
    });

    expect(result.id).toBe('notif-2');
    // Should NOT have called emit
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  it('should handle fromUser being null (deleted sender)', async () => {
    mockGetUserSocketIds.mockReturnValue([]);
    mockGetIO.mockReturnValue(mockIo);

    waitData.push([{
      id: 'notif-3',
      userId: 'user-2',
      type: 'friend_request',
      fromUserId: 'deleted-user',
      metadata: null,
      read: false,
      createdAt: new Date('2026-07-06T12:00:00Z'),
    }]);
    // No sender profile found
    waitData.push([]);

    const result = await createNotification({
      userId: 'user-2',
      type: 'friend_request',
      fromUserId: 'deleted-user',
    });

    expect(result.fromUsername).toBeUndefined();
    expect(result.fromDisplayName).toBeUndefined();
    // No socket IDs → no emit
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});
