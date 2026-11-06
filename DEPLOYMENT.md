# Deployment guide — Mộc

## Frontend preview on GitHub Pages

The [Pages deployment workflow](.github/workflows/deploy-pages.yml) builds the Vue 3/Vite frontend under `/ui-design/` and uploads a `404.html` fallback for client-side routing. The workflow build and the existing frontend CI passed before public hosting.

1. Make this frontend repository public.
2. Open **Settings → Pages → Build and deployment**, set source to **GitHub Actions**.
3. Open **Actions → Deploy Moc frontend to GitHub Pages**, choose **Run workflow** on `main`.
4. Read the deployment job's published URL; GitHub's usual project site URL is `https://ikurokami.github.io/ui-design/`.

## Full-stack functionality is a separate deployment

GitHub Pages hosts static frontend files only. Mộc's Go/PostgreSQL API lives in [ui-design-backend](https://github.com/IKurokami/ui-design-backend); it **is not hosted by Pages**. The frontend currently uses relative `/api` requests, so sign-in, reading progress, uploads and admin features will not function on the Pages URL without a separately deployed backend and an API reverse-proxy/routing configuration.

For a production service:
- Host the Go backend on a platform supporting persistent services and PostgreSQL.
- Configure non-default `JWT_SECRET`, `ENV=production`, `DB_DRIVER=postgres`, `DB_DSN`, `CLIENT_ORIGIN`, and `APP_BASE_URL`.
- Provide durable storage for `UPLOAD_DIR`, and configure SMTP for password reset.
- Route the frontend's `/api` and `/uploads` to the backend from the **same public origin** where possible, to simplify secure cookie authentication.
- Validate CORS, secure cookie policies, user roles and persistence before exposing registration to real users.

The static Pages deployment is suitable as a frontend preview, not proof of a functioning production backend.
