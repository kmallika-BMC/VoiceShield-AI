# VoiceShield AI

VoiceShield AI is a React/TypeScript and Express application for voice deepfake detection, voice enrollment, risk scoring, alerts, MFA, audit logging, and local blockchain fingerprint verification.

## Architecture

- **Frontend:** React + Vite, deployed to Vercel.
- **Backend:** Express + TypeScript in Docker, deployed to Render.
- **Database:** PGlite stored on a Render persistent disk.
- **Smart-contract integration:** Optional Polygon configuration; local ledger fallback is used when Polygon variables are empty.

## Run locally

Requirements: Node.js 22+ and npm.

```powershell
npm install
npm --prefix frontend install
npm --prefix backend install
npm run dev
```

Open `http://localhost:5173`. The backend health endpoint is `http://localhost:5000/api/health`.

## Validate locally

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:security
npm run test:e2e
```

## Deploy the backend to Render

1. Push this repository to GitHub.
2. Open [Render Blueprints](https://dashboard.render.com/blueprints).
3. Select **New Blueprint Instance**.
4. Enter:

   `https://github.com/kmallika-BMC/VoiceShield-AI.git`

5. Select the `main` branch and use the root `render.yaml`.
6. Add billing information if Render requires it for the Starter service and persistent disk.
7. Set these required secret values in Render:

   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET` (Render can generate this automatically)

8. Optionally set Polygon values:

   - `POLYGON_RPC_URL`
   - `POLYGON_PRIVATE_KEY`
   - `POLYGON_CONTRACT_ADDRESS`

9. Deploy the Blueprint. Render will provide a URL similar to:

   `https://voiceshield-backend.onrender.com`

10. Confirm the backend is healthy:

```powershell
Invoke-WebRequest https://voiceshield-backend.onrender.com/api/health
```

The response should contain:

```json
{"status":"ok","database":"connected"}
```

## Deploy the frontend to Vercel

1. Open [Vercel](https://vercel.com/new) and import the GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Use these project settings:

   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`

4. Add this production environment variable:

   ```text
   VITE_API_URL=https://voiceshield-backend.onrender.com
   ```

   Replace the value with the actual Render backend URL.

5. Deploy the project.

You can also deploy from the CLI:

```powershell
cd frontend
vercel login
vercel --prod
```

Set `VITE_API_URL` in the Vercel project settings before redeploying.

## Connect CORS after deployment

Update the Render environment variable `CORS_ORIGIN` to the final Vercel URL, for example:

```text
CORS_ORIGIN=https://your-project.vercel.app
```

Redeploy or restart the Render service after changing it. The frontend and backend URLs must use HTTPS in production.

## Production checklist

- Verify `/api/health` reports a connected database.
- Register a test user and verify login.
- Test audio upload and detection.
- Test voice enrollment and fingerprint verification.
- Test administrator login and audit logs.
- Confirm the Render persistent disk is mounted at `/app/data`.
- Never commit `.env`, private keys, JWT secrets, or API tokens.
- Rotate any credential that has been exposed in source files, chat, screenshots, or logs.

## Important security notice

If a GitHub personal access token has ever been placed in `mcp.json` or shared elsewhere, revoke it immediately in GitHub and create a replacement token. Credentials must be stored only in GitHub, Render, or Vercel secret settings.
