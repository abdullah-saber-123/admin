# Collections Dashboard — Frontend

React + Vite. Deploy to Vercel, pointed at the backend API.

## 1. Push this folder to its own git repo

```bash
cd frontend
git init
git add .
git commit -m "Collections dashboard frontend"
git remote add origin git@github.com:<you>/collection-dashboard-frontend.git
git push -u origin main
```

## 2. Deploy on Vercel

1. [vercel.com/new](https://vercel.com/new) → Import the repo you just pushed.
2. Framework preset: **Vite** (auto-detected).
3. Build command: `npm run build` (default) · Output dir: `dist` (default).
4. **Environment Variables** → add:
   ```
   VITE_API_URL = https://collect-api.swag.sa
   ```
   (must match whatever domain you pointed the Cloudflare Tunnel at for the backend)
5. Deploy.

## 3. Custom domain (optional)

Vercel project → Settings → Domains → add e.g. `collect.swag.sa`, then add
the CNAME Vercel gives you in Cloudflare DNS (same way you've pointed other
subdomains at Vercel, like swagpos.vercel.app's custom domain if you set one).

## Local dev

```bash
cp .env.example .env
# set VITE_API_URL=http://localhost:8060 (or your deployed backend URL)
npm install
npm run dev        # http://localhost:5173
```

## Redeploying

Vercel auto-deploys on every push to the connected branch:
```bash
git add .
git commit -m "update"
git push
```

## Notes

- Admin login token is stored in the browser's `localStorage` — logging in
  on one device doesn't affect others.
- `frontend/Dockerfile` in this repo is optional/unused for Vercel deploys —
  only needed if you ever want to self-host the frontend on the VM instead.
