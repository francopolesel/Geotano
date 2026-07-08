# My Profile Specification

## Purpose

SettingsPage gains a tabbed layout with 4 tabs: Profile, Preferences, Password, and My Profile. My Profile tab shows the user's stats and achievements read-only.

## Requirements

### Requirement: Tabbed layout

SettingsPage MUST display tabs: Profile, Preferences, Password, My Profile. Tab navigation follows the same pattern as FriendsPage.

- **Tab render**: GIVEN user navigates to Settings, WHEN page loads, THEN 4 tabs are visible with active tab highlighted.
- **Tab switch**: GIVEN user on Preferences tab, WHEN clicking "My Profile", THEN My Profile content renders without page reload.

### Requirement: Profile tab

Profile tab MUST show an editable form with the user's username, email, and avatar.

- **Edit profile**: GIVEN Profile tab active, WHEN user changes username and saves, THEN the change is persisted via PUT /users/:id/profile.

### Requirement: My Profile tab (stats)

My Profile tab MUST display read-only stats: best score, total games played, and perfect games count. Data comes from `GET /users/:id/profile`.

- **Stats render**: GIVEN My Profile tab active, WHEN data loads, THEN bestScore, totalGames, and perfectGames are displayed.

### Requirement: My Profile tab (achievements)

My Profile tab MUST display an achievements grid showing unlocked and locked achievements. Each achievement shows name, description, and unlock status.

- **Achievement grid**: GIVEN My Profile tab, WHEN achievements data loads, THEN a grid of all achievements renders with locked/unlocked visual distinction.

### Requirement: AppShell nav link

AppShell MUST include a "My Profile" navigation link that routes to the My Profile tab in Settings.

- **Nav link**: GIVEN AppShell rendered, WHEN user clicks "My Profile" link, THEN Settings page opens with My Profile tab active.

### Requirement: Hardcore achievements

The system MUST include 3 new hardcore achievements. The `all_modes` achievement MUST count base families (5) not variant slugs (15+).

- **Hardcore achievements**: GIVEN player completes hardcore conditions, WHEN `checkAchievements()` runs, THEN appropriate hardcore achievement is awarded.
- **All modes base count**: GIVEN player completed one game in each of the 5 base types (any variant), WHEN `all_modes` check runs, THEN achievement unlocks. Playing `flag-standard` and `flag-hardcore` counts as 1 base mode, not 2.
