// Utility to format session/cycle date ranges for frontend display
// Usage examples:
// formatSessionRange(session) -> "28.11.2025, 15:40 - 15:45"
// formatSessionRange(session, cycle) -> prefers session times; falls back to cycle start/end
// Works with both camelCase and PascalCase properties returned by API.

function toDate(v) {
  if (!v) return null;
  try { return new Date(v); } catch { return null; }
}

function pad(n) { return n.toString().padStart(2, '0'); }

function formatDate(d) {
  // dd.MM.yyyy
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
}

function formatTime(d) {
  // HH:mm
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatSessionRange(session = null, cycle = null) {
  // Accept session or cycle objects with either camelCase or PascalCase fields
  const sStart = session ? (session.startTime || session.StartTime || session.start || null) : null;
  const sEnd = session ? (session.endTime || session.EndTime || session.end || null) : null;
  const cStart = cycle ? (cycle.startDate || cycle.StartDate || cycle.start || null) : null;
  const cEnd = cycle ? (cycle.endDate || cycle.EndDate || cycle.end || null) : null;

  const start = toDate(sStart) || toDate(cStart);
  const end = toDate(sEnd) || toDate(cEnd);

  if (!start) return '';

  // If we have both start and end
  if (end) {
    // same day -> "dd.MM.yyyy, HH:mm - HH:mm"
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate()) {
      return `${formatDate(start)}, ${formatTime(start)} - ${formatTime(end)}`;
    }
    // different days -> "dd.MM.yyyy HH:mm - dd.MM.yyyy HH:mm"
    return `${formatDate(start)} ${formatTime(start)} - ${formatDate(end)} ${formatTime(end)}`;
  }

  // only start available -> "dd.MM.yyyy, HH:mm"
  return `${formatDate(start)}, ${formatTime(start)}`;
}

export default formatSessionRange;
