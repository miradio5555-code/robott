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
