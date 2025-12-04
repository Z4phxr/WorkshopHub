import api from './api';

export async function getInstructorPerformance(params = {}) {
  const query = new URLSearchParams();
  if (params.fromDate) query.append('fromDate', params.fromDate);
  if (params.toDate) query.append('toDate', params.toDate);
  query.append('page', params.page ?? 1);
  query.append('pageSize', params.pageSize ?? 20);
  query.append('sortBy', params.sortBy ?? 'revenue');
  query.append('sortDir', params.sortDir ?? 'desc');
  const headers = api.authHeaders();
  const resp = await api.get(`/api/reports/instructors/performance?${query.toString()}`, { headers });
  return resp.data;
}

export async function getParticipantsActivity(params = {}) {
  const query = new URLSearchParams();
  if (params.fromDate) query.append('fromDate', params.fromDate);
  if (params.toDate) query.append('toDate', params.toDate);
  query.append('page', params.page ?? 1);
  query.append('pageSize', params.pageSize ?? 20);
  query.append('sortBy', params.sortBy ?? 'totalPaid');
  query.append('sortDir', params.sortDir ?? 'desc');
  const headers = api.authHeaders();
  const resp = await api.get(`/api/reports/participants/activity?${query.toString()}`, { headers });
  return resp.data;
}

// backward compatibility (optional)
export const getTopPayingStudents = getParticipantsActivity;

export async function getOutstandingPayments(params = {}) {
  const query = new URLSearchParams();
  if (params.olderThanDays) query.append('olderThanDays', params.olderThanDays);
  if (params.minAmount) query.append('minAmount', params.minAmount);
  query.append('page', params.page ?? 1);
  query.append('pageSize', params.pageSize ?? 20);
  query.append('sortBy', params.sortBy ?? 'created');
  query.append('sortDir', params.sortDir ?? 'desc');
  const headers = api.authHeaders();
  const resp = await api.get(`/api/reports/payments/outstanding?${query.toString()}`, { headers });
  return resp.data;
}

// NEW: Report #5 - Payment Timeline
export async function getPaymentTimeline(params = {}) {
  const query = new URLSearchParams();
  if (params.fromDate) query.append('fromDate', params.fromDate);
  if (params.toDate) query.append('toDate', params.toDate);
  if (params.workshopId) query.append('workshopId', params.workshopId);
  if (params.status) query.append('status', params.status);
  query.append('page', params.page ?? 1);
  query.append('pageSize', params.pageSize ?? 20);
  query.append('sortBy', params.sortBy ?? 'createdAt');
  query.append('sortDir', params.sortDir ?? 'desc');
  const headers = api.authHeaders();
  const resp = await api.get(`/api/reports/payments/timeline?${query.toString()}`, { headers });
  return resp.data;
}

// NEW: Report #6 - Workshop Enrollment Roster
export async function getWorkshopEnrollmentRoster(workshopId, params = {}) {
  const query = new URLSearchParams();
  if (params.cycleId) query.append('cycleId', params.cycleId);
  if (params.status) query.append('status', params.status);
  query.append('page', params.page ?? 1);
  query.append('pageSize', params.pageSize ?? 20);
  query.append('sortBy', params.sortBy ?? 'enrolledAt');
  query.append('sortDir', params.sortDir ?? 'desc');
  const headers = api.authHeaders();
  const resp = await api.get(`/api/reports/workshops/${workshopId}/enrollments?${query.toString()}`, { headers });
  return resp.data;
}
