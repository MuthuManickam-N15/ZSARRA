<<<<<<< HEAD
# ZSARRA store: Stage 1 (foundation)

Next.js 14 + TypeScript + Tailwind + Prisma + PostgreSQL.

## Included in this stage
Brand tokens (ivory, bronze, black, white), layout shell, logo component, a home page that reads from the database, the full Prisma schema (users, sessions, catalog, variants, cart, wishlist, orders, payments, banners, settings) and a seed script.

## Windows Command Prompt setup
1. Install Node.js 20+ and PostgreSQL 15+, then create the database:
   `psql -U postgres -c "CREATE DATABASE zsarra;"`
2. In the project folder:
   ```
   copy .env.example .env
   notepad .env
   npm install
   npx prisma migrate dev --name init
   npm run db:seed
   npm run dev
   ```
3. Save your logo as `public\zsarra-logo.png`. The header picks it up automatically.
4. Open http://localhost:3000

The seed creates the admin account from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (12+ characters). Remove the password from `.env` afterwards.

## Next stages
2 Storefront pages, filters, product page. 3 Auth and sessions. 4 Cart and wishlist. 5 Admin. 6 Checkout and UPI QR payments. 7 Tests. 8 Deployment docs.

## Payments (UPI QR code)
Customers pay by UPI. There is no online payment gateway.
1. At checkout the customer picks an address and clicks **Pay ... by UPI**. The order is created, its stock is held for 1 hour, and the customer lands on the payment page (`/pay/<order>`).
2. The payment page shows the exact amount, your **QR code**, your **UPI ID and name**, and a box for the **UPI reference number (UTR)** from the payment app.
3. The customer pays, then sends the reference number. The order now waits for you. Orders that have a reference number are never cancelled automatically.
4. In **Admin > Payments > Awaiting verification** open your bank or UPI app, check that the amount and reference arrived, then click **Mark as paid**. The order becomes Confirmed. If the number doesn't match any money, click **Reject**: the customer can send another one. The dashboard shows how many payments are waiting.
5. To refund: cancel the order (stock returns), send the money back yourself, then click **Mark ... as refunded** on the order page.
A reference number can only be used once across all orders, and the amount confirmed is always the one the server calculated.

### Where to put your real QR code
- **Replace this file:** `public/payment/upi-qr.png` (in the project folder; keep the same name and PNG format). The shipped file is a DUMMY QR with a red 'DUMMY' caption. After replacing it, publish the change again (`git push`, or redeploy).
- **Or, without redeploying:** Admin > Settings > **Payment QR code** > upload your image (and use *Go back to the default QR file* to undo). An uploaded image wins over the file.
- Also set your real **UPI ID** and the **name on the UPI account** in Admin > Settings (the defaults are placeholders).
- Settings also has **Accept orders**: switch it off to pause checkout.

## Contact details and brand
The store name and contact details (phone, email, address) live in one file: `src/lib/brand.ts`. They appear in the footer, on the Contact page, in the FAQ, on policy pages, on the order and payment pages, and as the default store email in Settings.

## Stage 7: automated tests

Two kinds of tests:

**Unit tests (fast, no database, no browser).** They cover validation, pricing, order status rules, sessions and admin gates, image validation, cart totals, order creation (including a lost stock race), payment handling (including late payments and duplicate reference numbers).
```
npm install
npm test
```

**Browser (end-to-end) tests.** They drive a real browser against a running copy of the site and a SEPARATE test database. The test setup refuses to run unless the database name contains "test", so it can never touch your real data.
```
psql -U postgres -c "CREATE DATABASE zsarra_test;"
copy .env.test.example .env.test
notepad .env.test
npm run test:e2e:install
npm run test:db
npm run test:e2e
```
- `npm run test:db` migrates and seeds the test database (re-run it any time to restore the sample data).
- Tests start their own server on port 3100, so your normal `npm run dev` can keep running.
- Payment tests cover the QR payment page, reference numbers, admin verification, rejection and refunds. They need no payment account or keys.
- Leave the Cloudinary values blank in `.env.test` so test images are saved locally instead of uploaded.
- After a run, open the report with `npx playwright show-report`.

## Design system
One typeface (Assistant) and one type scale, defined in `src/app/globals.css`. Layout follows the conventions of large fashion marketplaces: a compact header with a wide search bar and icon links, a filter sidebar, dense product grids, a two-column product page and a card-style sign-in page. Colors stay on the four brand values: `#E9E7DB`, `#967751`, `#000000`, `#FFFFFF`.

## Hosting on Netlify
Follow **NETLIFY.md**: GitHub repository, a hosted Postgres database, Cloudinary for pictures, a handful of environment variables, and `npm run db:prod -- migrate` once. Pictures upload straight from the admin's browser to Cloudinary on the live site, because Netlify can't accept large uploads through the server.

## Customer reviews
- **Product pages** show the average rating, a star breakdown, the latest reviews and a "Write a review" form. Logged-in customers can post one review per product (posting again edits it) and delete their own. Reviews from customers with a paid, not-cancelled order for that product get a "Verified purchase" tag. Names are shown as first name plus last initial.
- **`/reviews`** lists every review with a star filter and pages, and links to the product. `/reviews?product=<slug>` shows one product's reviews.
- **Product cards** show a small rating badge, and the home page shows a "What customers say" strip of recent 4 and 5 star reviews. Everything stays hidden until real reviews exist: nothing is pre-filled.
- **Admin > Reviews** lets you search, hide (removes it from the store and from the averages) or delete reviews.
- Reviews added a database table. Run `npx prisma migrate dev --name reviews` once, then `npm run test:db` for the test database.

## Logo and product photos
The official logo is `public/logo.png` (untouched). The header and footer use `public/logo-mark.png`, the same artwork with its empty margin trimmed and its plain background made transparent so it sits cleanly on white or ivory. The browser tab icon is `src/app/icon.png`. The five sample products (ZM-201, ZM-202, ZM-203, ZW-201, ZW-202) use the photos in `public/catalog/`, fitted onto 3:4 canvases. Replace those photos with your own before launch.

## Adding hundreds of products at once (bulk import)
Log in to the admin and open **Bulk import** (`/admin/import`). The page has downloadable samples: a products file in Excel and CSV, an image report in Excel and CSV, and a ZIP of sample pictures.
1. **Product details:** upload an **Excel (.xlsx) or CSV** file, one row per product. Sizes and colors are separated with `|` and every size/color combination is created. Stock can be one number (`10`), per size (`S:5|M:8`) or per size and color (`S/Black:3|M/White:2`). Only the first sheet of a workbook is read; header names are forgiving (`Sale Price` works). Files are sent in batches of 100 rows, rows with problems are listed with their row number, and the good rows are still saved. A SKU that already exists is updated.
2. **Pictures:** select all pictures at once. Either name each file after its SKU (`ZM-201.jpg` = cover, `ZM-201_2.jpg` = second picture), or add an **image report** (Excel or CSV) with columns `image_file` (or `image_url`), `sku` and `position`, so pictures can have any file names. Links to pictures that are already online go in `image_url` and nothing is uploaded. Files not listed in the report are skipped and shown in the results. Using a position again replaces that picture, so repeating a run never creates duplicates.

Tips for 1,000 products: resize photos to about 1600 px on the long side first, use Cloudinary (see `.env.example`) so images are stored and compressed for you, and check your Cloudinary plan's storage and bandwidth limits. Old `.xls` files aren't supported: save as `.xlsx` or CSV.

## Backups and restoring your data
Everything you add (products, prices, stock, customers, orders, payments, settings) lives in PostgreSQL. Pictures live in Cloudinary (or in `public/uploads` if you haven't set Cloudinary). Resetting the database deletes the rows but not the Cloudinary pictures; the rows hold the links to them, so a backup of the database brings everything back.
- **Full backup:** `npm run db:backup` creates `backups\zsarra-<date>.dump` (and an archive of local pictures if you use them). Needs PostgreSQL's command line tools; if `pg_dump` isn't found, set `PG_BIN` (for example `set PG_BIN=C:\Program Files\PostgreSQL\16\bin`).
- **Restore:** stop the site, then `npm run db:restore -- backups\zsarra-<date>.dump` (it asks you to type the database name before it replaces anything).
- **Safe reset:** `npm run db:reset-safe` takes a backup first, then wipes and rebuilds an empty database. Avoid running `prisma migrate reset` or `prisma db push --force-reset` directly.
- **Catalogue-only backup:** Admin > Bulk import > *Download all products (CSV)*. It re-imports with the same page (prices, sizes, stock and picture links; not customers or orders).
- **Automatic daily backup on Windows:** Task Scheduler > Create Basic Task > daily > Start a program: `cmd.exe`, arguments: `/c cd /d D:\path\to\zsarra && npm run db:backup`.
- **Production:** also turn on your database host's automatic backups (Neon, Supabase and Railway all offer them) and keep copies of the `backups` folder somewhere other than this computer. Test a restore on a spare database now and then.

## Before you upload to Netlify
Run these on your computer. If all four pass, the hosted build should too.
```
npm install
npm run check:deploy
npm test
npm run build
```
`npm run check:deploy` looks for the usual causes of failed hosted builds (imports that only break on Netlify's Linux servers because of capital letters, files that must only run on the server being used in the browser, missing packages, undocumented settings, and secrets files inside the folder). `npm run build` is the real build. See NETLIFY.md.

