const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export async function submitTicket(payload, signal) {
  const res = await fetch(`${BASE}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchTickets(signal) {
  const res = await fetch(`${BASE}/tickets`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function checkHealth() {
  try {
    const res = await fetch(`${BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}

export async function sendTelegramMessage(text) {
  try {
    const res = await fetch(`${BASE}/telegram/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch {
    return null
  }
}

export async function regenerateDraft(ticketId) {
  const res = await fetch(`${BASE}/tickets/${ticketId}/regenerate-draft`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function sendResponse(ticketId, draft) {
  const res = await fetch(`${BASE}/tickets/${ticketId}/send-response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
