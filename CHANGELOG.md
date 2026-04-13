# Changelog

## [Unreleased]

### Added
- **Players page redesigned as avatar card grid** (`app/(app)/coach/players/page.tsx`)
  - Responsive grid of avatar cards with player name and club(s)
  - Amber dot indicator on inactive players (never logged in)
  - Double-click opens a detail modal showing avatar, name, email, phone, timezone, and clubs
  - **"+ Add User"** button (COACH/ADMIN only) opens an invite dialog that creates the player immediately, assigns them to a club and coach, and logs a temporary password and login link
- **Coach selection in Personal settings** (`app/(app)/settings/personal/page.tsx`)
  - Added "My Club(s) and Coaches" collapsible section
  - Shows coaches from the user's clubs; users can add or remove coach links
- **New API endpoints (backend)**
  - `POST /users/invite` — invite and create a new player
  - `GET /users/me/available-coaches` — coaches from shared clubs
  - `GET /users/me/coaches` — coaches currently linked to the user
  - `POST /users/me/coaches/:coachId` — link a coach
  - `DELETE /users/me/coaches/:coachId` — unlink a coach
- **New web proxy routes**
  - `POST /api/players/invite`
  - `GET /api/players/coaches`
  - `GET /api/players/coaches/linked`
  - `POST/DELETE /api/players/coaches/[coachId]`
- **Database**: added `@@unique([coachId, playerId])` constraint to `CoachPlayerLink` model

### Changed
- **Sidebar navigation**: renamed "Players/Teams" → "Teams/Players"
- **Dashboard tile**: title changed to "Teams / Players"; Teams count displayed first (with Users icon), followed by Players count
- **SAVE buttons** in Profile and Personal settings pages: changed from `bg-green-600 hover:bg-green-700` to `bg-green-800 hover:bg-green-600` (dark by default, lighter on hover)
- **Backend `getClubUsers`**: extended to return full user data — email, phone, timezone, lastLogin, and userClubs
