import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFriendsStore } from '../../../../store/friendsStore';
import { useTrucoPrefsStore } from '../../../../store/trucoPrefsStore';
import {
  createTrucoMatch,
  joinTrucoMatchByCode,
  lookupTrucoMatchByCode,
} from '../../../../lib/trucoApi';
import { statusOf } from '../../lib/apiStatus';

/**
 * Friends step of the Truco menu (v2 step-flow redesign, batch C).
 *
 * Leads with EXISTING friends — each row shows honest presence derived from
 * the friendsStore online set and an INVITE action for available friends.
 * The open-code lobby (create room code / join by code) is demoted to a
 * secondary collapsed section but keeps its EXACT handlers/testids/flow
 * (CU6): create POSTs {targetPoints} with NO friendId for open matches;
 * join-by-code runs the S3 GET pre-check so a bad code gets a friendly
 * message without firing the join POST.
 *
 * Invite flow = the SAME create-with-friendId call used before the redesign:
 * confirm → POST {targetPoints, friendId} → navigate into the match waiting
 * room, where acceptance (`truco:player-joined`) is already handled.
 */

export function FriendsLobby({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const friends = useFriendsStore((state) => state.friends);
  const onlineUsers = useFriendsStore((state) => state.onlineUsers);
  const targetPoints = useTrucoPrefsStore((state) => state.targetPoints);

  // ── Invite-a-friend state ───────────────────────────────────────────────────
  const [confirmingFriendId, setConfirmingFriendId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // ── Secondary code-section state (handlers identical to pre-v2 lobby) ──────
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  const confirmingFriend = friends.find((friend) => friend.friendId === confirmingFriendId);

  /** Shared create: friendId present ⇒ invite; absent ⇒ open code match. */
  const onCreate = async (friendId?: string) => {
    if (creating || sending) return;
    if (friendId) setSending(true);
    else setCreating(true);
    setLobbyError(null);
    try {
      // friendId omitted entirely for open code matches (backend treats the
      // field as optional; absence = waiting room shared by code).
      const created = await createTrucoMatch({
        targetPoints,
        ...(friendId ? { friendId } : {}),
      });
      navigate(`/truco/match/${created.matchId}`);
    } catch (err) {
      setLobbyError(
        statusOf(err) === 403 ? t('truco.error.notFriends') : t('truco.error.generic'),
      );
    } finally {
      setSending(false);
      setCreating(false);
    }
  };

  const onJoin = async () => {
    const code = codeInput.trim();
    if (!code || joining) return;
    setJoining(true);
    setLobbyError(null);
    try {
      // S3 convenience: GET pre-check gives a friendly "no such match" without
      // firing the join POST; authority remains the join call itself.
      await lookupTrucoMatchByCode(code);
      const joined = await joinTrucoMatchByCode(code);
      navigate(`/truco/match/${joined.matchId}`);
    } catch (err) {
      const status = statusOf(err);
      if (status === 404) setLobbyError(t('truco.error.codeNotFound'));
      else if (status === 409) setLobbyError(t('truco.error.notJoinable'));
      else setLobbyError(t('truco.error.generic'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <section
      data-testid="truco-menu-friend"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
    >
      <header className="mb-4 flex items-center gap-2">
        <button
          type="button"
          data-testid="truco-menu-back"
          aria-label={t('truco.menu.backToModes')}
          onClick={onBack}
          className={[
            'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-[var(--color-border)] text-lg text-[var(--color-foreground)]',
            'hover:bg-[var(--color-muted)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          ].join(' ')}
        >
          ←
        </button>
        <h2 className="text-xl font-black tracking-tight text-[var(--color-foreground)]">
          {t('truco.menu.friendsTitle')}
        </h2>
      </header>

      {/* EXISTING friends first — presence + invite action per row */}
      {friends.length === 0 ? (
        <div
          data-testid="truco-multi-no-friends"
          className="mb-4 flex flex-col items-start gap-2 rounded-lg border border-dashed border-[var(--color-border)] p-4"
        >
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t('truco.multi.noFriends')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/friends')}
            className="min-h-[44px] rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            {t('truco.multi.addFriends')}
          </button>
        </div>
      ) : (
        <ul className="mb-4 flex min-w-0 flex-col gap-2">
          {friends.map((friend) => {
            const online = onlineUsers.has(friend.friendId);
            return (
              <li
                key={friend.id}
                data-testid={`truco-friend-row-${friend.friendId}`}
                data-user-id={friend.friendId}
                className="flex min-h-[44px] min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    data-testid={`truco-friend-presence-${friend.friendId}`}
                    data-presence={online ? 'online' : 'offline'}
                    title={
                      online
                        ? t('truco.multi.presence.available')
                        : t('truco.multi.presence.offline')
                    }
                    className="flex shrink-0 items-center gap-1 text-xs text-[var(--color-muted-foreground)]"
                  >
                    <span
                      aria-hidden
                      className={[
                        'h-2 w-2 rounded-full',
                        online ? 'bg-emerald-500' : 'bg-[var(--color-border)]',
                      ].join(' ')}
                    />
                    <span aria-hidden>
                      {online ? t('truco.multi.presence.available') : t('truco.multi.presence.offline')}
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-foreground)]">
                    {friend.displayName || friend.username}
                  </span>
                </span>
                {online && (
                  <button
                    type="button"
                    data-testid={`truco-invite-${friend.friendId}`}
                    onClick={() => setConfirmingFriendId(friend.friendId)}
                    className="min-h-[44px] shrink-0 rounded-md bg-emerald-600 px-3 text-xs font-bold uppercase tracking-wide text-white transition-opacity hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    {t('truco.multi.invite')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Inline invite confirmation before any request fires */}
      {confirmingFriend && (
        <div
          data-testid="truco-invite-confirm"
          role="group"
          aria-label={t('truco.multi.inviteConfirm', { name: confirmingFriend.displayName || confirmingFriend.username })}
          className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40"
        >
          <p className="mb-2 text-sm font-medium text-[var(--color-foreground)]">
            {t('truco.multi.inviteConfirm', {
              name: confirmingFriend.displayName || confirmingFriend.username,
            })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="truco-invite-cancel"
              disabled={sending}
              onClick={() => setConfirmingFriendId(null)}
              className="min-h-[44px] rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              {t('truco.multi.cancel')}
            </button>
            <button
              type="button"
              data-testid="truco-invite-confirm-accept"
              disabled={sending}
              onClick={() => void onCreate(confirmingFriend.friendId)}
              className="min-h-[44px] rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              {sending ? t('truco.multi.inviteSending') : t('truco.multi.invite')}
            </button>
          </div>
        </div>
      )}

      {lobbyError && (
        <p
          data-testid="truco-multi-error"
          role="alert"
          className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
        >
          {lobbyError}
        </p>
      )}

      {/* SECONDARY: open-code lobby — same handlers/testids as the pre-v2 panel */}
      <div className="border-t border-[var(--color-border)] pt-2">
        <button
          type="button"
          data-testid="truco-code-toggle"
          aria-expanded={codeOpen}
          onClick={() => setCodeOpen((open) => !open)}
          className={[
            'flex min-h-[44px] w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]',
            'hover:bg-[var(--color-muted)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          ].join(' ')}
        >
          {t('truco.menu.codeSection')}
          <span aria-hidden>{codeOpen ? '▾' : '▸'}</span>
        </button>
        {codeOpen && (
          <div data-testid="truco-code-panel" className="mt-2 flex flex-col gap-3 pb-1">
            {/* Open code match: friendId omitted ⇒ waiting room shared by code */}
            <button
              type="button"
              data-testid="truco-multi-create"
              disabled={creating}
              onClick={() => void onCreate()}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              {creating ? t('truco.multi.creating') : t('truco.multi.create')}
            </button>

            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('truco.multi.joinTitle')}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                data-testid="truco-multi-code-input"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                placeholder={t('truco.multi.codePlaceholder')}
                maxLength={8}
                className="min-h-[44px] min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm uppercase tracking-widest text-[var(--color-foreground)] placeholder:tracking-normal placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              />
              <button
                type="button"
                data-testid="truco-multi-join"
                disabled={joining || codeInput.trim().length === 0}
                onClick={() => void onJoin()}
                className="min-h-[44px] shrink-0 rounded-md border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                {joining ? t('truco.multi.joining') : t('truco.multi.join')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
