/**
 * normalizeCycles.js
 * Canonical cycle normalization: uses addressOverrideId and maxParticipantsOverride,
 * and computes effectiveMaxParticipants from workshop defaults.
 */
export default function normalizeCycles(input, workshopDefaults = {}) {
  const arr = Array.isArray(input) ? input : (input ? (input.cycles || input.Cycles || [input]) : []);
  const workshopMax = workshopDefaults.maxParticipants ?? workshopDefaults.MaxParticipants ?? null;
  const workshopAddrId = workshopDefaults.addressId ?? workshopDefaults.AddressId ?? null;

  return (arr || []).map(c => {
    const sessionsRaw = c.sessions ?? c.Sessions ?? [];
    const sessions = Array.isArray(sessionsRaw) ? sessionsRaw.map(s => ({
      id: s.id ?? s.Id,
      topic: s.topic ?? s.Topic ?? null,
      startTime: s.startTime ?? s.StartTime ?? null,
      endTime: s.endTime ?? s.EndTime ?? null,
      addressOverrideId: s.addressOverrideId ?? s.AddressOverrideId ?? s.addressId ?? s.AddressId ?? null,
      instructors: s.instructors ?? s.Instructors ?? []
    })) : [];

    const cycleOverride = c.maxParticipantsOverride ?? c.MaxParticipantsOverride ?? null;
    const effectiveMaxParticipants = cycleOverride ?? (c.maxParticipants ?? c.MaxParticipants ?? workshopMax) ?? null;

    const addrOverride = c.addressOverrideId ?? c.AddressOverrideId ?? null;
    const effectiveAddressId = addrOverride ?? (c.addressId ?? c.AddressId ?? workshopAddrId) ?? null;

    return {
      id: c.id ?? c.Id,
      displayName: c.displayName ?? c.DisplayName ?? null,
      workshopId: c.workshopId ?? c.WorkshopId ?? workshopDefaults.id ?? workshopDefaults.Id ?? null,
      startDate: c.startDate ?? c.StartDate ?? null,
      endDate: c.endDate ?? c.EndDate ?? null,
      isOpenForEnrollment: c.isOpenForEnrollment ?? c.IsOpenForEnrollment ?? c.isOpen ?? false,
      // canonical capacity and address override
      maxParticipantsOverride: cycleOverride,
      effectiveMaxParticipants,
      addressOverrideId: addrOverride,
      effectiveAddressId,
      // server-provided counts if present
      activeEnrollments: c.activeEnrollments ?? c.activeEnrollmentsCount ?? c.ActiveEnrollments ?? c.ActiveEnrollmentsCount ?? 0,
      sessions
    };
  });
}
