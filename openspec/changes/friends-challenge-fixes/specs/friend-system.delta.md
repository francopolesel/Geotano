# Friend System — Delta Spec

## Change Type

UI layout only — no behavioral changes to the friend system logic.

## Modified Requirements

### Requirement: Challenge action (UI layout update)

**Old**: Desktop cards stretch based on username length. Mobile uses single-column flex-col with 36px minimum button height.

**New**: 
- **Desktop card uniformity**: GIVEN a friends list rendered on viewport >= 640px, WHEN friend cards are displayed, THEN all cards have equal width regardless of username or display name length.
- **Mobile touch targets**: GIVEN a friends list rendered on viewport < 640px, WHEN the user interacts with action buttons (challenge, chat, remove, block), THEN each button has a minimum touch target of 44×44px with adequate spacing.
- **Mobile layout**: GIVEN a friend card on mobile, WHEN rendered, THEN the card shows avatar + name in the top row (tappable to profile) and action buttons in a separate row below.

## Unchanged Requirements

All other requirements from the base spec remain in effect — request flow, search, invite links, challenge notification behavior, and friend management logic are unchanged.

## Test Scenarios

- **TC-LAYOUT-1**: GIVEN friends with short and long usernames, WHEN rendered on desktop, THEN all cards are the same width.
- **TC-LAYOUT-2**: GIVEN a friend card on mobile, WHEN rendered, THEN all action buttons have at least 44px height and do not overlap.
- **TC-LAYOUT-3**: GIVEN a friend card on mobile, WHEN user taps the username area, THEN they navigate to the profile (same as desktop behavior).
