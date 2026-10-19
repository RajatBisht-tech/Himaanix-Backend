# Himaanix Backend

Express + MongoDB API starter for a fashion e-commerce website.

## Requirements
- Node.js 20+ recommended
- MongoDB local instance or MongoDB Atlas

## Setup
1. Open this folder in a terminal.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `MONGO_URI`, `JWT_SECRET`, and `FRONTEND_URL`.
4. Start MongoDB if using a local database.
5. Run `npm run dev`.

Health check: `GET http://localhost:5000/api/health`

## Import products
Run `npm run import:products -- "C:\path\to\products.json"` to add or update products from a JSON array (or an object with a `products` array). Products are matched by MongoDB `_id`; categories are created if needed. MongoDB Extended JSON category IDs are resolved against existing categories, then mapped from product details to Women, Men, or Kids; remaining products go into Other. Products not present in the file are left unchanged. Add `--dry-run` after the file path to validate the input without changing the database.

## Routes
- `/api/auth` register, login, profile
- `/api/products` public listing/details and admin CRUD; `GET /api/products/tags` returns distinct tags for active products. Listing supports category IDs, names, or tags (repeat `category` for multiple values), price filters, and `newest`, `featured`, `low`, `high`, or `name` sorting. Results are paginated up to 50 per page.
- `/api/categories` list and admin CRUD
- `/api/cart` authenticated cart operations
- `/api/orders` order history; checkout deliberately returns 501 until secure checkout is implemented
- `/api/coupons` validate and admin create
- `/api/reviews` product reviews and admin moderation

## Important security notes
- `.env` is ignored by Git. Change the placeholder `JWT_SECRET` before running.
- Registration always creates a normal `user`; never accept a role from public registration.
- Create the first admin account through a controlled database/admin bootstrap process, not a public registration field.
- Configure rate limiting, production logging, HTTPS, and a production-grade secrets manager before launch.
- Product image URLs are stored as strings; image upload integration is not included.
- Checkout and payment-provider webhooks are not implemented. Do not accept client-submitted totals or mark orders paid without verified provider events.
- Coupon validation is a preview only; usage limits must be atomically enforced during order placement.
