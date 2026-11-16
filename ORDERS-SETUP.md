# Orders, emails and inventory: setup and daily use

This update adds direct ordering on the website, order alerts in your Gmail inbox, an orders panel, a list of emails people gave you, an inventory for stock placed with two partner shops, and a rebuilt analytics dashboard.

## Your new pages

| Page | What it is for | Who can open it |
|---|---|---|
| `https://thepapertheory.in/orders.html` | Orders, payment QR, order emails, visitor emails | You (owner password), or one order from its alert email |
| `https://thepapertheory.in/inventory.html` | Record and update stock given to each place | You (owner password) |
| `https://thepapertheory.in/stock.html?place=a` | Read-only stock list for place 1 | That place, with its access code |
| `https://thepapertheory.in/stock.html?place=b` | Read-only stock list for place 2 | That place, with its access code |
| `https://thepapertheory.in/admin.html` | Analytics dashboard | You (owner password) |

The owner password is the same `CATALOGUE_ADMIN_PASSWORD` you already use for the store editor.

## One-time setup in Vercel

Open your Vercel project → Settings → Environment Variables.

1. **Storage (skip if analytics or reviews already work).** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from a free Upstash Redis database. Orders, emails and inventory are stored there.
2. **Owner password (skip if already set).** `CATALOGUE_ADMIN_PASSWORD`.
3. **Email from thepapertheory.in@gmail.com.**
   1. Sign in to that Gmail account and turn on 2-Step Verification (Google Account → Security).
   2. Open `https://myaccount.google.com/apppasswords`, create an app password named "Website orders" and copy the 16 letters.
   3. Add the variable `MAIL_APP_PASSWORD` with those 16 letters.
4. Redeploy once.

Never put the app password in a file, in GitHub or in a chat. It lives only in Vercel.

Optional variables: `MAIL_USER` (sending address; default `thepapertheory.in@gmail.com`), `ORDER_ALERT_EMAIL` (where new-order alerts go; default is the same inbox), `MAIL_FROM_NAME` (default `The Paper Theory`), `SITE_URL` (default: the address the order was placed on).

After the redeploy, open `/orders.html` → **Payment & email** → **Send a test email to my inbox**.

## Add your payment QR

`/orders.html` → **Payment & email**. Enter your UPI ID and the name on the account, upload the QR image from your UPI app, and save. The QR is attached inside every payment email. You can replace it at any time.

Until a QR or UPI ID is saved, the confirmation email asks the customer to reply for payment details.

## How an order flows

1. A shopper fills the bag and delivery details and presses **Place order**. Email is now required at checkout. No payment is taken on the website.
2. The order is saved, and **you** get an email from thepapertheory.in@gmail.com with the items, address, phone and email, and a **Review & confirm this order** button. Replying to that email writes to the customer.
3. The button opens the order in the panel. Set the shipping charge (0 for free), add an optional message, and press **Confirm & email payment request**.
4. The customer now receives their order details, the amount to pay, your QR code and UPI ID. Nothing is emailed to a customer before you confirm.
5. When the money arrives, press **Mark as paid & email receipt**. Revenue appears in analytics at this point.
6. When you dispatch, enter the courier and tracking number and press **Mark as shipped & email tracking**.

Orders at or above the free-shipping amount for India arrive with shipping already set to free. The server takes prices from your published catalogue, not from the shopper's browser; an item it cannot match is flagged "Price not matched to catalogue" for you to check.

**Add an order** in the panel records orders you took on WhatsApp, Instagram or in person, so the panel and revenue stay complete. No email is sent for those.

"Confirm order on WhatsApp" and the order PDF are still in the bag as a second option, and the bag points shoppers to WhatsApp if the order desk cannot be reached.

## Visitor emails

A website cannot see a visitor's email address unless the visitor types it. The **Visitor emails** tab lists everyone who placed an order or signed up in the new "New drops, first" box in the footer, with name, city, order count and the source they came from. You can search, copy all addresses or export a CSV. Anonymous visits (source, device, pages, approximate city) stay in Analytics.

## Inventory for the two places

1. Open `/inventory.html`. Rename "Place 1" and "Place 2", and set an access code (6+ characters) for each.
2. Press **+ Add product** for each product you hand over: place, name, price, quantity, and the date given. Typing a product name suggests your catalogue products and fills the price.
3. Press **Save changes**.
4. Send each place its link (**Copy link**) and its access code. They see only their own list and cannot change it.

Update **Sold** when a place tells you what has sold; "Left", stock value and sold value are worked out for you.

## What is stored

Orders hold the customer's name, phone, email, delivery address and items. They are kept in your Upstash database until you delete them from the panel. Analytics events remain anonymous. Tell customers how you use their details in your privacy wording.

## New products in this update

Four 12-sticker sheets were added the same way as earlier packs (product, pack, 48 individual catalogue codes, product pages, sitemap): Cute Ghost Moods (`GHOST-001…012`), Capybara Calm (`CAPY-…`), Girl Who Codes (`GCODE-…`) and Dev Life (`DEV-…`). They follow the existing sheet pricing of ₹99 regular / ₹199 holographic and the 3 × 4, 2-inch description. Change any of it in the store editor.

## Checks

`npm run check` now also runs `scripts/verify-orders.cjs`, which tests the order flow, emails, access rules and inventory against an in-memory database with no network.
