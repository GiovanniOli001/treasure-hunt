# Treasure Hunt

Conference competition app. Participants scan a QR code, drop a pin on a map. Closest pin to the hidden treasure wins.

## Tech Stack
- Frontend: Vanilla JS + Leaflet.js maps on Cloudflare Pages
- Backend: TypeScript on Cloudflare Workers
- Database: Cloudflare D1 (SQLite)

## Setup

### Backend
```bash
cd workers
npm install
# Create D1 database
npx wrangler d1 create treasure-hunt-db
# Update database_id in wrangler.toml
# Apply schema
npx wrangler d1 execute treasure-hunt-db --file=src/schema.sql
# Set JWT secret
npx wrangler secret put JWT_SECRET
# Deploy
npx wrangler deploy
```

### Frontend
Connect the `frontend/` directory to Cloudflare Pages.

## Usage
1. Login to admin at `/admin.html`
2. Create a game with map config and form fields
3. Activate the game
4. Share QR code pointing to `/play.html?code=your-code`
5. Participants drop pins and submit entries
6. Set treasure location on admin map
7. Reveal winner - closest pin wins
