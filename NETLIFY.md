# Hosting ZSARRA on Netlify

Follow the steps in order. The site will be at `https://zsarra.netlify.app` if that name is free (otherwise Netlify suggests another; use it everywhere below).
I could not run a real Netlify build from my side, so the checks in section 1 are important: they are the best way to find a problem on your own computer before Netlify does.

## What Netlify can and cannot do for this site
- **Drag-and-drop upload does not work.** Netlify's drag-and-drop box hosts only plain static files. ZSARRA runs code on the server (logins, orders, admin), so you publish it from a **GitHub repository** (section 6) or with the **Netlify command line** (section 7). Do not upload the zip file itself.
- **Netlify has no database and no file storage.** You need a free **PostgreSQL** database (Neon) and a free **Cloudinary** account for product pictures.
- **There is no payment gateway.** Customers pay by UPI QR code and you verify each payment in the admin (see README: Payments). No payment account or keys are needed.

## 1. Check everything on your computer first (10 minutes)
In Command Prompt, inside the project folder:
```
npm install
npm run check:deploy
npm test
npm run build
```
- `npm run check:deploy` must end with **All checks passed.** It catches the usual build failures (wrong capital letters in file names, server-only code used in the browser, missing packages, secrets files left in the folder).
- `npm run build` is the real build, the same one Netlify runs. If it finishes without an error, the Netlify build should too. If it fails, send me the message.
- Do not continue until both pass. (`npm test` should also pass.)

## 2. Accounts you need
GitHub, Netlify, Neon (database), Cloudinary (pictures). All have free plans; check their limits against your expected traffic.

## 3. Create the database (Neon)
1. In Neon create a project named `zsarra`, in the region closest to your customers.
2. Copy **two** connection strings from the Neon dashboard:
   - **Direct** (host has no `-pooler`): for creating the tables from your computer (step 4).
   - **Pooled** (host contains `-pooler`): for the live site. Add this to the end:
     `?sslmode=require&pgbouncer=true&connect_timeout=15&connection_limit=1`
     Example: `postgresql://USER:PASS@ep-xxxx-pooler.us-east-2.aws.neon.tech/zsarra?sslmode=require&pgbouncer=true&connect_timeout=15&connection_limit=1`

## 4. Create the tables and your admin account (once)
1. If you have not already, create the migration for the Reviews table on your computer (needs your local database running): `npx prisma migrate dev --name reviews` (it also records a small change to the payment table's default value). Keep the `prisma/migrations` folder with the project. (A brand-new project with no migrations: `npx prisma migrate dev --name init`.)
2. Copy `.env.netlify.example` to `.env.netlify`. Put the **direct** string in `DATABASE_URL`, your email in `ADMIN_EMAIL`, and a long unique password in `ADMIN_PASSWORD`.
3. Run:
```
npm run db:prod -- migrate
npm run db:prod -- admin
```
Each command shows which database it will change and waits for you to type `yes`. Optional demo products: `npm run db:prod -- sample`. Forgot the admin password: `npm run db:prod -- admin --reset`.

## 5. Cloudinary
In the Cloudinary dashboard copy the **Cloud name**, **API key** and **API secret**. Product pictures, banners and your QR upload go here.

## 6. Publish with GitHub (recommended)
**Easiest on Windows: GitHub Desktop**
1. Install GitHub Desktop and sign in. **File > Add local repository**, choose the project folder, and accept "create a repository" when asked.
2. Look at the list of changed files before committing. It must NOT contain `.env`, `.env.test`, `.env.netlify`, `node_modules` or `.next` (they are ignored automatically; if you see them, stop and tell me).
3. Commit ("ZSARRA store"), then **Publish repository** (keep it **Private**).

**Or with commands:** `git init`, `git add .`, `git commit -m "ZSARRA store"`, `git branch -M main`, `git remote add origin https://github.com/YOUR-NAME/zsarra-store.git`, `git push -u origin main`.

Do not drag the project into the GitHub website: it can't take this many files and doesn't unzip.

Then in Netlify: **Add new site > Import an existing project > GitHub** and pick the repository. Build settings are read from `netlify.toml` (build command `npm run build`, the Next.js runtime). Leave them as they are. **Do not press Deploy yet.**

## 7. Environment variables (before the first deploy)
Netlify: **Site configuration > Environment variables > Add a variable**. Add these:

| Name | Value |
|---|---|
| `DATABASE_URL` | the **pooled** string from step 3 |
| `NEXT_PUBLIC_SITE_URL` | `https://zsarra.netlify.app` (your real address) |
| `CLOUDINARY_CLOUD_NAME` | from step 5 |
| `CLOUDINARY_API_KEY` | from step 5 |
| `CLOUDINARY_API_SECRET` | from step 5 |
| `CRON_SECRET` | any long random text (lets the scheduled cleanup call the site) |

Nothing else is needed. (`SESSION_SECRET` and payment keys are not used.) Then press **Deploy**. Watch the deploy log; a successful deploy ends with "Site is live".

**Alternative: Netlify command line** (no GitHub): `npm install -g netlify-cli`, `netlify login`, `netlify init` (choose "Create & configure a new site", name it `zsarra`), add the variables above with `netlify env:set NAME value`, then `netlify deploy --build --prod`. This builds on your computer and uploads the result.

## 8. Set the site name and address
**Site configuration > General > Site details > Change site name** to `zsarra`. If the name is taken, pick another and update `NEXT_PUBLIC_SITE_URL` to match, then **Deploys > Trigger deploy**. A custom domain: **Domain management > Add a domain** (HTTPS is automatic), then update `NEXT_PUBLIC_SITE_URL` and redeploy.

## 9. Test the live site (do all of these)
1. Home page shows the ZSARRA logo and the footer shows **+91 87541 58897**, **zsarrafashion@gmail.com** and **Pongalur, Tiruppur - 641667**. The Contact page shows the same.
2. Log in at `/admin/login` with the admin from step 4.
3. **Admin > Settings:** set your real **UPI ID** and name, and upload your **QR code** under *Payment QR code*. Save.
4. Add one product with a picture (this tests Cloudinary). Open it on the live site.
5. Register a test customer, add the product, check out, and look at the payment page: it must show your QR, amount and UPI ID. Send a test reference number.
6. In **Admin > Payments > Awaiting verification** the payment appears. Click **Mark as paid**, and check the order becomes Confirmed.
7. Cancel the test order (the stock comes back) and delete the test product.

## Where to replace the QR code image
- **File:** `public/payment/upi-qr.png` (inside the project folder). The shipped one is a dummy with a red DUMMY caption. Replace it with your own PNG using the **same file name**, commit and push (or `netlify deploy --build --prod`) so Netlify republishes.
- **No redeploy needed:** Admin > Settings > Payment QR code > upload. The uploaded image is used instead of the file.

## 10. What runs by itself
`netlify/functions/expire-orders.mts` runs every 10 minutes on the published site. It cancels orders that are 1 hour old with no payment details and returns their stock. Orders where the customer sent a reference number are kept until you verify them. It needs `CRON_SECRET`.

## 11. Updating the site later
- Code or text changes: commit and push (GitHub Desktop: Commit, then Push). Netlify rebuilds by itself.
- **If a change adds database tables or columns:** run `npm run db:prod -- migrate` from your computer **before** you push.
- Backups: switch on Neon's automatic backups, and keep copies of `npm run db:backup` files elsewhere (see README).

## 12. If something fails
| Symptom | Fix |
|---|---|
| Build log: "Module not found" or "Can't resolve" | Run `npm run check:deploy` on your computer; it names the file. Usually capital letters in a name. |
| Build log: "Secrets scanning found secrets" | A secret ended up in the code or a public variable. `NEXT_PUBLIC_SITE_URL` is already excluded in `netlify.toml`. Never put keys in `NEXT_PUBLIC_` variables. |
| Build log: "Failed to collect page data" or a database error | `DATABASE_URL` is missing or wrong in Netlify's variables. Fix it and redeploy. |
| Site opens but pages say "table does not exist" | Step 4 was not run on the production database. Run `npm run db:prod -- migrate`. |
| "Query engine library not found" | Redeploy with **Deploys > Trigger deploy > Clear cache and deploy site**. The schema already includes the engines Netlify needs. |
| "Too many connections" | The site's `DATABASE_URL` must be the **pooled** string with `pgbouncer=true&connection_limit=1`. |
| Picture upload says "Image storage isn't configured" or "Invalid Signature" | The three `CLOUDINARY_*` variables are missing or wrong. |
| "Invalid Server Actions request" when pressing a button | `NEXT_PUBLIC_SITE_URL` doesn't match the address you are visiting. Fix it and redeploy. |
| Bulk import stops with "The server didn't answer" | Run the same file again. It is safe to repeat and works in small batches. |
| Admin password lost | `npm run db:prod -- admin --reset` |

## 13. Limits worth knowing
- Netlify functions stop after about 10 seconds and accept requests up to about 6 MB. The site works within both (small import batches, pictures upload straight from the browser to Cloudinary).
- Login, sign-up, checkout and review limits are kept in each server's memory, so on Netlify they slow down abuse but don't strictly cap it.
- Netlify's free plan has monthly limits (build minutes, function calls, bandwidth). Check them against your traffic.
