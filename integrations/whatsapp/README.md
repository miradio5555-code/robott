# ULA Factory · WhatsApp integration

The site uses Supabase for its inbox. Evolution Go and this Python adapter run in Docker; there are no Python package dependencies. Migration 52 installs the schema, workspace isolation, outbound queue, quotes and notification triggers.

## Current behavior

- Website → Messages: conversations, unread/human/mine filters, message history, agent replies, take/close/return-to-bot, associated orders, quote confirmation, delivery failures/retry.
- Owner settings: message sending, bot replies, new order/status/payment notices, notification language (ru/en/zh/vi), status template with `{order}` and `{status}`. The heartbeat shows when the adapter or WhatsApp is unavailable.
- Bot: personal orders via the customer's existing secret cabinet link; request wizard (name, photo/link/description, quantity, wishes, explicit confirmation); agent handoff; STOP/START and unlinking. Requests become `source=request` orders. One JPEG/PNG/WebP photo up to 5 MB is supported; other attachments are listed in the inbox and opened in WhatsApp by an agent.
- The workspace team can see orders matching the full international phone number. Bot self-service still requires the bearer-authorized cabinet link. Matching only suffixes or names never authorizes bot access.
- Quote amounts come from the saved order total. A quote can be accepted only by its recipient; changing the amount/currency or waiting seven days invalidates it. Acceptance is not a payment and does not buy anything automatically.
- Payment notices reflect `orders.paid_amount` changed in the site's database. There is no bank/payment-provider integration and no automatic acceptance of payment screenshots.
- Private inbound photos are stored in `wa-attachments`; request photos are attached to `order-photos`. Secret cabinet links are redacted from the shared chat log.
- Inbox history starts when this adapter version is enabled. Old WhatsApp history is not imported.

## Configuration and launch

`config.local.json` is local-only, ignored by git, mode 600. Fields: `EVOLUTION_URL`, `INSTANCE_TOKEN`, `WEBHOOK_SECRET` (32+ random characters), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WORKSPACE_ID`, `INBOX_ENABLED:true`, optional `ORDER_DEFAULTS`. Use only the intended workspace, never a browser/public key file for server credentials.

Apply `migration_52_whatsapp_inbox.sql` in Supabase before enabling `INBOX_ENABLED`. The adapter's `wa_settings` row must exist with the configured workspace; connection status and heartbeat are service-managed.

Run `docker compose up -d --build` in this directory. The external Docker network `evolution-go_default` must exist. The adapter's internal port 8091 has no host/public binding. Preserve the `data/` directory and Evolution Go's PostgreSQL volumes. Configure Evolution Go's instance webhook to `http://whatsapp-bridge:8091/webhook/<WEBHOOK_SECRET>` with MESSAGE, READ_RECEIPT, SEND_MESSAGE subscriptions. Enable WEBHOOK_FILES and keep MinIO disabled for base64 photo intake.

## Delivery and failure behavior

Outbound messages are leased with `FOR UPDATE SKIP LOCKED`. Failures receive exponential backoff, then a visible failed state after five attempts. Expired final leases also become failed. Delivery/read receipts do not get downgraded by a later send response. While WhatsApp is disconnected the worker waits rather than consuming attempts; a bounded reconnect is attempted every minute. Stable provider IDs are sent on retries, but exactly-once delivery is not guaranteed after an ambiguous network failure.

STOP cancels future normal messages, including pending queue entries when dispatched. The opt-out acknowledgement may still be sent. Manager mode pauses the bot; MENЮ resumes it. Sending from the website automatically takes the conversation; messages sent directly from the linked phone also pause the bot when observed as outgoing events.

## Validation

- `python3 -m unittest discover -s integrations/whatsapp -p 'test_*.py'`
- `node tests/check_web.js`
- `bash tests/run_db_tests.sh` — temporary isolated PostgreSQL only.

The SQL tests cover tenant isolation, unauthorized service RPC calls, deduplication, full-number linking and quote recipient checks. A local fixture validates the browser UI without contacting customers. Live test messages/order confirmation should be performed with a controlled customer number; never use real customer orders as test fixtures.

## Hosting

The current adapter runs on the owner's computer. It requires Docker and the computer to stay on. For a VPS transfer, provision Docker, copy the protected configuration and databases over an authorized secure connection, restore volumes, stop the local dispatcher before starting the server dispatcher, and update the internal webhook. Do not publish Evolution Go's administrative API or this webhook port directly to the Internet. The specific VPS address/access remains to be identified by the owner.

## Self-service workspace connection (migration 53)

Owners can connect their own WhatsApp from the home card or Messages → Your WhatsApp. The site calls `wa_request_connection`; the local supervisor provisions a deterministic Evolution instance, then publishes a short-lived QR image in `wa_pairing`. Only that workspace's active owner can read the QR or request refresh/disconnect. Staff can use the inbox after connection but cannot replace the owner's number.

`MULTI_TENANT:true` enables `supervisor.py`. Protected platform configuration additionally needs `EVOLUTION_ADMIN_KEY`; never place it in the site. `wa_connections` stores each instance's token and is inaccessible to browser roles. Before switching an existing installation, register its current instance/token in this private table and seed its pairing status, preserving the old local state directory for the default workspace.

Each new workspace uses its own `data/<workspace UUID>/state.sqlite`, instance token, signed webhook and database scope. The supervisor's HMAC-verified URL determines the workspace; payload identifiers cannot override routing. Other workspaces' credentials are not fetched when provisioning a new instance. Existing instances are checked by deterministic ID and token before reuse.

Disconnect stops this workspace's automation and message dispatch, preserving conversation history and device credentials for reconnecting. It does not delete the customer's WhatsApp account or erase inbox history. QR requests expire after three minutes; the image displayed in the browser has a shorter TTL and refreshes while pairing. No global API key, raw pairing code or instance token is returned to the website.

The central supervisor still needs to remain running. Remote buyers talk only to Supabase; they never need access to localhost or the administrative Evolution API. For 24/7 use, move the central stack to the platform's server once its address/access is available.

The local Evolution Go checkout also contains `evolution-local.patch`: using the fetched WhatsApp Web version for the handshake, and allowing the reconnect endpoint when its runtime client is already disconnected. Apply the patch to the same upstream revision before reproducing this stack on a server. The reconnect change has a focused Go regression test in the local Evolution checkout.

Pairing speed: signed QRCode/Connected/PairSuccess events publish pairing updates immediately; the periodic supervisor scan remains a fallback. During active pairing the website polls only the owner-protected pairing row once per second, without reloading chat history. Completion cannot overwrite an already-arrived QR/connected event, and stale browser responses cannot replace a newer state. Existing instance sessions remain persistent, so normal return visits do not require another scan.

The local engine also reuses one shared, bounded device-store pool across instances and QR refreshes. This fixes PostgreSQL exhaustion after repeated reconnects. Regression tests cover concurrent reuse and recovery after a failed pool initialization. Apply the patch with `git apply --unidiff-zero`.
