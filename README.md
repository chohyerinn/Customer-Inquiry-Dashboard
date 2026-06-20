# Customer Inquiry Dashboard

A privacy-aware customer-support intake and routing service. The application accepts customer inquiries from a web form or Gmail, detects personally identifiable information (PII), classifies urgency and category, creates a response draft with CLOVA Studio when it is safe to do so, and surfaces the result in an operations dashboard.

## Why it exists

Support teams need a fast first response without sending sensitive customer data to an external language-model service. This project puts a small policy gate in front of the AI workflow: inquiries that contain PII are masked, routed for human review, and receive a template response instead of an external AI call.

## Highlights

- Ingests inquiries through the built-in web form and an IMAP/Gmail polling worker.
- Detects email addresses, Korean mobile numbers, order IDs, and account-like identifiers.
- Masks detected PII before persistence and prevents PII-containing text from reaching CLOVA Studio.
- Classifies each request by category and urgency, then selects a senior, dedicated, priority, or general queue.
- Generates AI response drafts for non-PII inquiries; falls back to a safe template if the AI service is unavailable.
- Uses a circuit breaker to avoid repeated failed CLOVA requests.
- Sends Telegram notifications for PII detection, high-priority tickets, cost thresholds, and AI fallbacks.
- Provides a lightweight dashboard for ticket status, queue distribution, PII counts, AI usage, and daily cost.

## Architecture

```text
Web form ──┐
           ├── FastAPI service ── PostgreSQL
Gmail IMAP ┘          │              Redis
                       ├── CLOVA Studio (non-PII only)
                       └── Telegram alerts
```

The service stores tickets, assignments, response metadata, PII events, and daily AI-cost totals in PostgreSQL. Redis is included as a supporting cache/service dependency. Nginx can sit in front of the FastAPI application as a reverse proxy.

## Tech stack

| Area | Technology |
| --- | --- |
| API and UI | FastAPI, Uvicorn, server-rendered HTML/CSS/JavaScript |
| Data | PostgreSQL 16, Redis 7 |
| AI | CLOVA Studio HCX-003 |
| Email intake | Python `imaplib` / Gmail IMAP |
| Notifications | Telegram Bot API |
| Deployment | Docker Compose, Nginx |

## Inquiry flow

1. A customer submits a web inquiry or a worker polls a new Gmail message.
2. The API detects PII and creates a masked version of the text when necessary.
3. Keyword rules classify the ticket category and urgency.
4. PII tickets use a template response and require review. Non-PII tickets request a CLOVA response draft when the circuit breaker is closed.
5. The ticket is assigned to an appropriate support queue and recorded in PostgreSQL.
6. The dashboard and Telegram alerts expose the operational result.

## Run locally

### Prerequisites

- Docker and Docker Compose
- A CLOVA Studio API key for AI response generation (optional for template-only fallback)
- Gmail IMAP credentials if email ingestion is required
- Telegram bot credentials if alerts are required

### Configure environment variables

The current Compose file defines service variables inline. Before running this project outside a controlled local environment, replace those values with variable substitutions or a secret manager; use the following values as the configuration contract. Do not commit real credentials.

```env
DATABASE_URL=postgresql://ai_user:ai_password@postgres:5432/ai_cs
REDIS_URL=redis://redis:6379/0

CLOVA_API_KEY=replace-me
CLOVA_COST_PER_CALL=10
COST_ALERT_THRESHOLD=1000

TELEGRAM_BOT_TOKEN=replace-me
TELEGRAM_CHAT_ID=replace-me

IMAP_HOST=imap.gmail.com
IMAP_USER=your-address@gmail.com
IMAP_PASSWORD=your-gmail-app-password
POLL_INTERVAL=30
API_URL=http://api:8000/tickets
```

### Start the services

```bash
docker compose up -d --build
```

Then open:

- Customer inquiry form: `http://localhost:8000/` or `http://localhost:8000/form`
- Operations dashboard: `http://localhost:8000/dashboard`
- Health endpoint: `http://localhost:8000/health`

To stop the stack:

```bash
docker compose down
```

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service and circuit-breaker health |
| `POST` | `/tickets` | Create and process a web or email inquiry |
| `GET` | `/tickets` | List recent tickets |
| `DELETE` | `/tickets/{ticket_id}` | Delete a ticket and related records |
| `GET` | `/assignments` | View queue-assignment history |
| `GET` | `/stats` | Dashboard statistics and AI-cost totals |
| `POST` | `/email/sync` | Remove email tickets no longer present in the mailbox |
| `POST` | `/tickets/{ticket_id}/send-response` | Send a reviewed draft through Telegram |
| `GET` | `/circuit-breaker` | Inspect CLOVA circuit-breaker state |

Example request:

```bash
curl -X POST http://localhost:8000/tickets \
  -H "Content-Type: application/json" \
  -d '{"channel":"web","text":"My order has not arrived yet. Please check the delivery status."}'
```

## Project layout

```text
app/
  main.py           # FastAPI routes, PII policy, routing, dashboard, and persistence
  email_worker.py   # Containerized Gmail IMAP polling worker
nginx/
  ai-cs-app.conf    # Nginx reverse-proxy configuration
docker-compose.yml  # API, worker, PostgreSQL, and Redis services
Dockerfile          # Application image definition
email_poller.py      # Standalone Gmail polling script
response_endpoint.py # Reference snippet for a Telegram response endpoint
```

## Security notes

- PII detection currently uses regular expressions. Treat it as a baseline policy layer and extend the patterns before production use.
- PII-containing inquiries are masked and handled with a template response; the raw text is not sent to CLOVA Studio.
- Keep API keys, bot tokens, database passwords, and Gmail app passwords in environment variables or a secret manager.
- Restrict dashboard and database access at the network layer when deploying.

## License

No license has been specified for this project. Add one before distributing or reusing the code publicly.
