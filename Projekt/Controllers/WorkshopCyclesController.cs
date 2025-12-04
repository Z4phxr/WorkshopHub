using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using System;
using System.Data;
using System.Globalization;
using System.Linq;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Text;
using System.IO;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkshopCyclesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;
        public WorkshopCyclesController(AppDbContext context, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _audit = audit;
        }

        // get user id
        private int? GetCurrentUserId()
        {
            try
            {
                var idStr = User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(idStr)) return null;
                if (int.TryParse(idStr, out var id)) return id;
                return null;
            }
            catch { return null; }
        }

        private async Task<bool> IsUserInstructorForWorkshop(int? userId, int workshopId)
        {
            if (!userId.HasValue) return false;
            var w = await _context.Workshops.AsNoTracking().FirstOrDefaultAsync(x => x.Id == workshopId);
            if (w == null) return false;
            if (w.DefaultInstructorId == userId.Value) return true;
            try
            {
                return await _context.InstructorAssignments.AnyAsync(a => a.WorkshopId == workshopId && a.InstructorId == userId.Value);
            }
            catch { return false; }
        }

        [HttpGet("workshop/{workshopId}")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<object>>> GetCyclesForWorkshop(int workshopId)
        {
            try
            {
                var workshop = await _context.Workshops
                    .Include(w => w.DefaultInstructor)
                    .FirstOrDefaultAsync(w => w.Id == workshopId);
                if (workshop == null) return NotFound("Workshop not found");

                var cyclesRaw = await _context.WorkshopCycles
                    .Include(c => c.Sessions)
                    .Include(c => c.Address)
                    .Where(c => c.WorkshopId == workshopId)
                    .OrderByDescending(c => c.StartDate)
                    .ToListAsync();

                var cycleIds = cyclesRaw.Select(c => c.Id).ToList();
                var enrollmentCounts = new Dictionary<int,int>();
                if (cycleIds.Count > 0)
                {
                    var counts = await _context.Enrollments
                        .Where(e => cycleIds.Contains(e.WorkshopCycleId) && e.Status != null && e.Status.ToUpper() == "ACTIVE")
                        .GroupBy(e => e.WorkshopCycleId)
                        .Select(g => new { CycleId = g.Key, Count = g.Count() })
                        .ToListAsync();
                    enrollmentCounts = counts.ToDictionary(x => x.CycleId, x => x.Count);
                }

                var result = cyclesRaw.Select(c => {
                    var sessions = c.Sessions ?? new List<WorkshopSession>();
                    return new {
                        c.Id,
                        c.DisplayName,
                        c.WorkshopId,
                        c.StartDate,
                        c.EndDate,
                        c.IsOpenForEnrollment,
                        maxParticipantsOverride = c.MaxParticipantsOverride,
                        effectiveMaxParticipants = c.MaxParticipantsOverride ?? workshop.MaxParticipants,
                        activeEnrollments = enrollmentCounts.TryGetValue(c.Id, out var ec) ? ec : 0,
                        activeEnrollmentsCount = enrollmentCounts.TryGetValue(c.Id, out var ec2) ? ec2 : 0,
                        addressOverrideId = c.AddressId,
                        effectiveAddressId = c.AddressId ?? workshop.AddressId,
                        address = c.Address == null ? null : new { c.Address.Id, c.Address.City, c.Address.Street, c.Address.BuildingNumber, c.Address.Room },
                        isSeries = workshop.IsSeries,
                        sessions = sessions.Select(s => new {
                            id = s.Id,
                            topic = s.Topic,
                            startTime = s.StartTime,
                            endTime = s.EndTime,
                            addressOverrideId = s.AddressId ?? c.AddressId ?? workshop.AddressId,
                            effectiveMaxParticipants = c.MaxParticipantsOverride ?? workshop.MaxParticipants
                        })
                    }; }).ToList();
                return Ok(result);
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "CYCLE_LIST_FAILED", ex.ToString()); } catch { }
                return Ok(new { cycles = Array.Empty<object>(), warning = "General cycle fetch failure", inner = ex.InnerException?.Message });
            }
        }

        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<ActionResult<object>> GetCycle(int id)
        {
            try
            {
                var cycle = await _context.WorkshopCycles
                    .Include(c => c.Workshop)
                    .Include(c => c.Sessions)
                    .Include(c => c.Address)
                    .FirstOrDefaultAsync(c => c.Id == id);
                if (cycle == null) return NotFound();

                // staff can see enrollments
                var isStaff = User?.Identity?.IsAuthenticated == true && (User.IsInRole("Admin") || User.IsInRole("Instructor"));

                var enrollments = new List<object>();
                if (isStaff)
                {
                    enrollments = await _context.Enrollments
                        .Include(e => e.User)
                        .Where(e => e.WorkshopCycleId == id && e.Status != null && e.Status.ToUpper() == "ACTIVE")
                        .OrderByDescending(e => e.EnrolledAt)
                        .Select(e => new
                        {
                            e.Id,
                            e.EnrolledAt,
                            e.Status,
                            user = e.User == null ? null : new { e.User.Id, e.User.FirstName, e.User.LastName, e.User.Email }
                        })
                        .ToListAsync<object>();
                }

                var activeCount = await _context.Enrollments.CountAsync(e => e.WorkshopCycleId == id && e.Status != null && e.Status.ToUpper() == "ACTIVE");

                var cycleDto = new
                {
                    cycle.Id,
                    cycle.DisplayName,
                    cycle.WorkshopId,
                    cycle.StartDate,
                    cycle.EndDate,
                    cycle.IsOpenForEnrollment,
                    maxParticipantsOverride = cycle.MaxParticipantsOverride,
                    effectiveMaxParticipants = cycle.MaxParticipantsOverride ?? cycle.Workshop!.MaxParticipants,
                    activeEnrollmentsCount = activeCount,
                    addressOverrideId = cycle.AddressId,
                    effectiveAddressId = cycle.AddressId ?? cycle.Workshop.AddressId,
                    address = cycle.Address == null ? null : new { cycle.Address.Id, cycle.Address.City, cycle.Address.Street, cycle.Address.BuildingNumber, cycle.Address.Room },
                    workshop = new { cycle.Workshop.Id, cycle.Workshop.Title, cycle.Workshop.IsSeries },
                    sessions = (cycle.Sessions ?? Enumerable.Empty<WorkshopSession>()).Select(s => new
                    {
                        id = s.Id,
                        topic = s.Topic,
                        startTime = s.StartTime,
                        endTime = s.EndTime,
                        addressOverrideId = s.AddressId ?? cycle.AddressId ?? cycle.Workshop.AddressId,
                        effectiveMaxParticipants = cycle.MaxParticipantsOverride ?? cycle.Workshop.MaxParticipants
                    })
                };

                return Ok(new { cycle = cycleDto, enrollments });
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "CYCLE_FETCH_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch cycle", details = ex.ToString() });
            }
        }

        public class CreateCycleDto
        {
            public int WorkshopId { get; set; }
            public string? DisplayName { get; set; }
            public DateTime? StartDate { get; set; }
            public DateTime? EndDate { get; set; }
            public bool IsOpenForEnrollment { get; set; } = true;
            public int? MaxParticipantsOverride { get; set; }
            public int? AddressId { get; set; }
            public int? InstructorOverrideId { get; set; }
        }

        public class SingleEventCreateDto
        {
            public int WorkshopId { get; set; }
            public string? DisplayName { get; set; }
            public DateTime StartDate { get; set; }
            public DateTime? EndDate { get; set; }
            public DateTime StartTime { get; set; }
            public DateTime EndTime { get; set; }
            public bool IsOpenForEnrollment { get; set; } = true;
            public int? MaxParticipantsOverride { get; set; }
            public int? AddressId { get; set; }
            public int? InstructorOverrideId { get; set; }
        }

        public class UpdateCycleDto : CreateCycleDto
        {
            public int Id { get; set; }
        }

        private async Task<(bool ok, string? msg)> ValidateInstructor(int userId)
        {
            var instr = await _context.Users
                .Include(u => u.UserRoles!)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (instr == null) return (false, "Instructor does not exist");
            var isInstructor = instr.UserRoles?.Any(r => r.Role.Name == "Instructor") ?? false;
            if (!isInstructor) return (false, "Selected user is not an Instructor");
            return (true, null);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<ActionResult<object>> CreateCycle([FromBody] CreateCycleDto dto)
        {
            if (dto.WorkshopId <= 0) return BadRequest("WorkshopId required");

            // non admin must own
            if (!User.IsInRole("Admin"))
            {
                var userId = GetCurrentUserId();
                if (!await IsUserInstructorForWorkshop(userId, dto.WorkshopId)) return Forbid();
            }

            var workshop = await _context.Workshops.FindAsync(dto.WorkshopId);
            if (workshop == null) return BadRequest("Workshop does not exist");

            if (dto.AddressId.HasValue && await _context.Addresses.FindAsync(dto.AddressId.Value) == null)
                return BadRequest("Address does not exist");

            if (dto.InstructorOverrideId.HasValue)
            {
                if (dto.InstructorOverrideId.Value <= 0)
                    return BadRequest("InstructorOverrideId is invalid");
                var (ok, msg) = await ValidateInstructor(dto.InstructorOverrideId.Value);
                if (!ok) return BadRequest(msg);
            }

            DateTime start = dto.StartDate ?? DateTime.UtcNow;
            DateTime? end = dto.EndDate;

            if (!workshop.IsSeries)
            {
                if (!dto.StartDate.HasValue)
                    return BadRequest("StartDate required for single (non-series) workshop cycle.");
                end = end ?? start;
            }
            else
            {
                if (!dto.StartDate.HasValue)
                {
                    start = DateTime.UtcNow;
                }
            }

            var cycle = new WorkshopCycle
            {
                WorkshopId = dto.WorkshopId,
                DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? string.Format(CultureInfo.InvariantCulture, "{0} - {1:MMMM yyyy}", workshop.Title, start) : dto.DisplayName.Trim(),
                StartDate = start,
                EndDate = end,
                IsOpenForEnrollment = dto.IsOpenForEnrollment,
                MaxParticipantsOverride = dto.MaxParticipantsOverride,
                AddressId = dto.AddressId,
                InstructorOverrideId = (dto.InstructorOverrideId.HasValue && dto.InstructorOverrideId.Value > 0) ? dto.InstructorOverrideId : null
            };

            _context.WorkshopCycles.Add(cycle);
            await _context.SaveChangesAsync();

            if (cycle.InstructorOverrideId.HasValue)
            {
                _context.InstructorAssignments.Add(new InstructorAssignment { WorkshopCycleId = cycle.Id, InstructorId = cycle.InstructorOverrideId.Value, IsLead = true });
                await _context.SaveChangesAsync();
            }

            // LOG: Cycle created
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.CYCLE_CREATED, 
                $"Cycle '{cycle.DisplayName}' (ID={cycle.Id}) created for workshop '{workshop.Title}' (ID={workshop.Id})");

            return CreatedAtAction(nameof(GetCycle), new { id = cycle.Id }, new { cycle.Id });
        }

        [HttpPost("single")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<ActionResult<object>> CreateSingleEvent([FromBody] SingleEventCreateDto dto)
        {
            try
            {
                if (dto.WorkshopId <= 0) return BadRequest("WorkshopId required");

                // non admin must own
                if (!User.IsInRole("Admin"))
                {
                    var userId = GetCurrentUserId();
                    if (!await IsUserInstructorForWorkshop(userId, dto.WorkshopId)) return Forbid();
                }

                var workshop = await _context.Workshops.FindAsync(dto.WorkshopId);
                if (workshop == null) return BadRequest("Workshop does not exist");

                if (dto.AddressId.HasValue && await _context.Addresses.FindAsync(dto.AddressId.Value) == null)
                    return BadRequest("Address does not exist");

                if (dto.InstructorOverrideId.HasValue)
                {
                    if (dto.InstructorOverrideId.Value <= 0)
                        return BadRequest("InstructorOverrideId is invalid");
                    var (ok, msg) = await ValidateInstructor(dto.InstructorOverrideId.Value);
                    if (!ok) return BadRequest(msg);
                }

                if (dto.StartDate == default)
                    return BadRequest("StartDate is required");
                if (dto.StartTime == default || dto.EndTime == default)
                    return BadRequest("StartTime and EndTime are required");

                var sessionStart = dto.StartDate.Date + dto.StartTime.TimeOfDay;
                var endDateForTime = dto.EndDate?.Date ?? dto.StartDate.Date;
                var sessionEnd = endDateForTime + dto.EndTime.TimeOfDay;
                if (sessionEnd <= sessionStart) return BadRequest("EndTime must be after StartTime");

                var cycle = new WorkshopCycle
                {
                    WorkshopId = dto.WorkshopId,
                    DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? (workshop.Title + " - " + sessionStart.ToString("d", CultureInfo.InvariantCulture)) : dto.DisplayName.Trim(),
                    StartDate = sessionStart,
                    EndDate = sessionEnd,
                    IsOpenForEnrollment = dto.IsOpenForEnrollment,
                    MaxParticipantsOverride = dto.MaxParticipantsOverride,
                    AddressId = dto.AddressId,
                    InstructorOverrideId = (dto.InstructorOverrideId.HasValue && dto.InstructorOverrideId.Value > 0) ? dto.InstructorOverrideId : null
                };

                _context.WorkshopCycles.Add(cycle);
                try { await _context.SaveChangesAsync(); } catch (Exception exSaveCycle) { return StatusCode(500, new { error = "Failed to save cycle", inner = exSaveCycle.InnerException?.Message, details = exSaveCycle.Message }); }

                var session = new WorkshopSession
                {
                    WorkshopCycleId = cycle.Id,
                    Topic = string.IsNullOrWhiteSpace(dto.DisplayName) ? (cycle.DisplayName ?? workshop.Title) : dto.DisplayName.Trim(),
                    StartTime = sessionStart,
                    EndTime = sessionEnd,
                    AddressId = dto.AddressId ?? cycle.AddressId ?? workshop.AddressId
                };

                _context.WorkshopSessions.Add(session);
                try { await _context.SaveChangesAsync(); } catch (Exception exSaveSession) { return StatusCode(500, new { error = "Failed to save session", inner = exSaveSession.InnerException?.Message, details = exSaveSession.Message }); }

                if (dto.MaxParticipantsOverride.HasValue)
                {
                    cycle.MaxParticipantsOverride = dto.MaxParticipantsOverride;
                    _context.WorkshopCycles.Update(cycle);
                    try { await _context.SaveChangesAsync(); } catch (Exception exUpdateCap) { return StatusCode(500, new { error = "Failed to update capacity", inner = exUpdateCap.InnerException?.Message, details = exUpdateCap.Message }); }
                }

                if (cycle.InstructorOverrideId.HasValue)
                {
                    _context.InstructorAssignments.Add(new InstructorAssignment { WorkshopCycleId = cycle.Id, InstructorId = cycle.InstructorOverrideId.Value, IsLead = true });
                    try { await _context.SaveChangesAsync(); } catch (Exception exAssign) { return StatusCode(500, new { error = "Failed to save instructor assignment", inner = exAssign.InnerException?.Message, details = exAssign.Message }); }
                }

                return CreatedAtAction(nameof(GetCycle), new { id = cycle.Id }, new { cycle.Id, sessionId = session.Id });
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "CYCLE_CREATE_SINGLE_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to create single event", inner = ex.InnerException?.Message, details = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<IActionResult> UpdateCycle(int id, [FromBody] UpdateCycleDto dto)
        {
            if (id != dto.Id) return BadRequest("Ids do not match");
            var existing = await _context.WorkshopCycles.Include(c => c.Workshop).FirstOrDefaultAsync(c => c.Id == id);
            if (existing == null) return NotFound();

            // non admin must own
            if (!User.IsInRole("Admin"))
            {
                var userId = GetCurrentUserId();
                var workshopId = existing.WorkshopId;
                if (!await IsUserInstructorForWorkshop(userId, workshopId)) return Forbid();
            }

            if (dto.AddressId.HasValue && await _context.Addresses.FindAsync(dto.AddressId.Value) == null)
                return BadRequest("Address does not exist");

            if (dto.InstructorOverrideId.HasValue && dto.InstructorOverrideId.Value <= 0)
                return BadRequest("InstructorOverrideId is invalid");

            var oldDisplayName = existing.DisplayName;
            existing.DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? existing.DisplayName : dto.DisplayName.Trim();
            existing.IsOpenForEnrollment = dto.IsOpenForEnrollment;
            existing.MaxParticipantsOverride = dto.MaxParticipantsOverride;
            existing.AddressId = dto.AddressId;
            existing.InstructorOverrideId = dto.InstructorOverrideId;

            if (!existing.Workshop.IsSeries && dto.StartDate.HasValue)
            {
                existing.StartDate = dto.StartDate.Value;
                existing.EndDate = dto.EndDate ?? existing.StartDate;
            }

            await _context.SaveChangesAsync();
            
            // LOG: Cycle updated
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.CYCLE_UPDATED, 
                $"Cycle ID={id} updated for workshop '{existing.Workshop?.Title}' (ID={existing.WorkshopId}): '{oldDisplayName}' → '{existing.DisplayName}'");
            
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<IActionResult> DeleteCycle(int id, [FromQuery] bool force = true)
        {
            try
            {
                var cycle = await _context.WorkshopCycles
                    .Include(c => c.Workshop)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == id);
                if (cycle == null) return NotFound();

                var cycleName = cycle.DisplayName ?? $"Cycle {id}";
                var workshopTitle = cycle.Workshop?.Title ?? "Unknown";

                // non admin must own
                if (!User.IsInRole("Admin"))
                {
                    var userId = GetCurrentUserId();
                    if (!await IsUserInstructorForWorkshop(userId, cycle.WorkshopId)) return Forbid();
                }

                if (!force)
                {
                    var hasEnrollments = await _context.Enrollments.AnyAsync(e => e.WorkshopCycleId == id && (e.Status == null || e.Status.ToUpper() == "ACTIVE"));
                    if (hasEnrollments)
                        return Conflict(new { error = "CycleDeleteBlocked", detail = "Cycle has active enrollments. Retry with force=true to remove everything." });
                }

                var exists = await _context.WorkshopCycles.AsNoTracking().AnyAsync(c => c.Id == id);
                if (!exists) return NotFound();

                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                // set session context
                try { await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User); } catch { }
                using var tx = conn.BeginTransaction();
                try
                {
                    using var cmd = conn.CreateCommand();
                    cmd.Transaction = tx;
                    cmd.CommandText = @"DELETE FROM dbo.Payments WHERE EnrollmentId IN (SELECT Id FROM dbo.Enrollments WHERE WorkshopCycleId=@id);
DELETE FROM dbo.Enrollments WHERE WorkshopCycleId=@id;
DELETE FROM dbo.WorkshopSessions WHERE WorkshopCycleId=@id;
DELETE FROM dbo.InstructorAssignments WHERE WorkshopCycleId=@id;
DELETE FROM dbo.WorkshopCycles WHERE Id=@id;";
                    var p = cmd.CreateParameter(); p.ParameterName = "@id"; p.Value = id; cmd.Parameters.Add(p);
                    var affected = await cmd.ExecuteNonQueryAsync();
                    tx.Commit();
                    
                    // LOG: Cycle deleted
                    await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.CYCLE_DELETED, 
                        $"Cycle '{cycleName}' (ID={id}) deleted from workshop '{workshopTitle}' (force={force.ToString().ToLower()})");
                    
                    return NoContent();
                }
                catch (Exception exTx)
                {
                    try { tx.Rollback(); } catch { }
                    await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                        $"Failed to delete cycle ID={id}: {exTx.Message}");
                    return StatusCode(500, new { error = "Failed to delete cycle", detail = exTx.Message });
                }
                finally { try { await conn.CloseAsync(); } catch { } }
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to delete cycle ID={id}: {ex.Message}");
                return StatusCode(500, new { error = "Failed to delete cycle", detail = ex.Message });
            }
        }

        [HttpPut("{id}/cancel-enrollments")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<IActionResult> CancelAllEnrollmentsForCycle(int id)
        {
            var cycle = await _context.WorkshopCycles
                .Include(c => c.Workshop)
                .FirstOrDefaultAsync(c => c.Id == id);
            if (cycle == null) return NotFound("WorkshopCycle not found");

            // non admin must own
            if (!User.IsInRole("Admin"))
            {
                var userId = GetCurrentUserId();
                if (!await IsUserInstructorForWorkshop(userId, cycle.WorkshopId)) return Forbid();
            }

            try
            {
                var conn = _context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
                try { await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User); } catch { }
            }
            catch { }

            await using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var enrollments = await _context.Enrollments
                    .Where(e => e.WorkshopCycleId == id && e.Status != null && e.Status.ToUpper() == "ACTIVE")
                    .ToListAsync();

                if (enrollments.Count == 0)
                {
                    await tx.CommitAsync();
                    return Ok(new { cancelled = 0 });
                }

                var now = DateTime.UtcNow;
                foreach (var e in enrollments)
                {
                    e.Status = "Cancelled";
                    e.CancelledAt = now;
                }

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                // LOG: Enrollments cancelled
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.CYCLE_ENROLLMENTS_CANCELLED, 
                    $"All enrollments ({enrollments.Count}) cancelled for cycle '{cycle.DisplayName}' (ID={id}), workshop '{cycle.Workshop?.Title}' (ID={cycle.WorkshopId})");

                return Ok(new { cancelled = enrollments.Count });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to cancel enrollments for cycle ID={id}: {ex.Message}");
                return StatusCode(500, ex.Message);
            }
        }

        // GET: api/workshopcycles/{id}/enrollments/download
        [HttpGet("{id}/enrollments/download")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<IActionResult> DownloadEnrollmentsCsv(int id)
        {
            // only owner or admin
            var cycle = await _context.WorkshopCycles.Include(c => c.Workshop).FirstOrDefaultAsync(c => c.Id == id);
            if (cycle == null) return NotFound("Cycle not found");

            var userId = GetCurrentUserId();
            if (!User.IsInRole("Admin"))
            {
                var isOwner = (cycle.InstructorOverrideId == userId) || (cycle.Workshop != null && cycle.Workshop.DefaultInstructorId == userId);
                var assignmentExists = false;
                try { assignmentExists = await _context.InstructorAssignments.AnyAsync(a => (a.WorkshopCycleId == id || a.WorkshopId == cycle.WorkshopId) && a.InstructorId == userId); } catch {}
                if (!isOwner && !assignmentExists) return Forbid();
            }

            var enrollments = await _context.Enrollments
                .Include(e => e.User)
                .Where(e => e.WorkshopCycleId == id)
                .OrderBy(e => e.EnrolledAt)
                .ToListAsync();

            var lines = new List<string>();
            lines.Add("EnrollmentId,UserId,FirstName,LastName,Email,Status,EnrolledAt,CancelledAt");
            foreach (var e in enrollments)
            {
                var csvLine = string.Format("{0},{1},\"{2}\",\"{3}\",\"{4}\",{5},\"{6}\",\"{7}\"",
                    e.Id,
                    e.UserId,
                    e.User?.FirstName?.Replace("\"", "\"\"") ?? "",
                    e.User?.LastName?.Replace("\"", "\"\"") ?? "",
                    e.User?.Email?.Replace("\"", "\"\"") ?? "",
                    e.Status,
                    e.EnrolledAt.ToString("o"),
                    e.CancelledAt?.ToString("o") ?? ""
                );
                lines.Add(csvLine);
            }

            var csv = string.Join('\n', lines);
            var bytes = System.Text.Encoding.UTF8.GetBytes(csv);
            return File(bytes, "text/csv", $"enrollments_cycle_{id}.csv");
        }

        // returns cycles where current user is instructor 
        [HttpGet("mine")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<ActionResult<IEnumerable<object>>> GetMyCycles()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();
            try
            {
                var assignedCycleIds = new List<int>();
                var assignedWorkshopIds = new List<int>();
                try
                {
                    if (await TableExistsAsync("InstructorAssignments"))
                    {
                        assignedCycleIds = await _context.InstructorAssignments
                            .Where(a => a.InstructorId == userId.Value && a.WorkshopCycleId != null)
                            .Select(a => a.WorkshopCycleId!.Value)
                            .Distinct()
                            .ToListAsync();

                        assignedWorkshopIds = await _context.InstructorAssignments
                            .Where(a => a.InstructorId == userId.Value && a.WorkshopId != null)
                            .Select(a => a.WorkshopId!.Value)
                            .Distinct()
                            .ToListAsync();
                    }
                }
                catch { }

                var q = _context.WorkshopCycles
                    .Include(c => c.Workshop).ThenInclude(w => w.DefaultInstructor)
                    .Include(c => c.Address)
                    .Include(c => c.InstructorOverride)
                    .AsQueryable();

                q = q.Where(c =>
                    (c.InstructorOverrideId.HasValue && c.InstructorOverrideId.Value == userId.Value)
                    || (!c.InstructorOverrideId.HasValue && (
                        (c.Workshop != null && c.Workshop.DefaultInstructorId == userId.Value)
                        || assignedCycleIds.Contains(c.Id)
                        || assignedWorkshopIds.Contains(c.WorkshopId)
                    )));

                var cycles = await q.OrderByDescending(c => c.StartDate).ToListAsync();
                var cycleIds = cycles.Select(c => c.Id).ToList();

                var enrollmentCounts = new Dictionary<int,int>();
                if (cycleIds.Count > 0 && await _context.Database.CanConnectAsync())
                {
                    try
                    {
                        var counts = await _context.Enrollments
                            .Where(e => cycleIds.Contains(e.WorkshopCycleId) && e.Status != null && e.Status.ToUpper() == "ACTIVE")
                            .GroupBy(e => e.WorkshopCycleId)
                            .Select(g => new { CycleId = g.Key, Count = g.Count() })
                            .ToListAsync();
                        enrollmentCounts = counts.ToDictionary(x => x.CycleId, x => x.Count);
                    }
                    catch { }
                }

                var result = cycles.Select(c => new {
                    id = c.Id,
                    displayName = c.DisplayName,
                    workshopId = c.WorkshopId,
                    workshopTitle = c.Workshop?.Title,
                    startDate = c.StartDate,
                    endDate = c.EndDate,
                    isOpenForEnrollment = c.IsOpenForEnrollment,
                    maxParticipants = c.MaxParticipantsOverride ?? c.Workshop?.MaxParticipants,
                    address = c.Address == null ? null : new { c.Address.Id, c.Address.City, c.Address.Street, c.Address.BuildingNumber, c.Address.Room },
                    activeEnrollmentsCount = enrollmentCounts.TryGetValue(c.Id, out var ec) ? ec : 0,
                    effectiveInstructor = (c.InstructorOverride != null) ? new { id = c.InstructorOverride.Id, firstName = c.InstructorOverride.FirstName, lastName = c.InstructorOverride.LastName } : (c.Workshop?.DefaultInstructor != null ? new { id = c.Workshop.DefaultInstructor.Id, firstName = c.Workshop.DefaultInstructor.FirstName, lastName = c.Workshop.DefaultInstructor.LastName } : null)
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "CYCLE_MINE_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch instructor cycles", details = ex.ToString() });
            }
        }

        // GET: api/workshopcycles/{id}/enrollments/pdf
        [HttpGet("{id}/enrollments/pdf")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<IActionResult> DownloadEnrollmentsPdf(int id)
        {
            var cycle = await _context.WorkshopCycles.Include(c => c.Workshop).FirstOrDefaultAsync(c => c.Id == id);
            if (cycle == null) return NotFound("Cycle not found");

            var userId = GetCurrentUserId();
            if (!User.IsInRole("Admin"))
            {
                var isOwner = (cycle.InstructorOverrideId == userId) || (cycle.Workshop != null && cycle.Workshop.DefaultInstructorId == userId);
                var assignmentExists = false;
                try { assignmentExists = await _context.InstructorAssignments.AnyAsync(a => (a.WorkshopCycleId == id || a.WorkshopId == cycle.WorkshopId) && a.InstructorId == userId); } catch {}
                if (!isOwner && !assignmentExists) return Forbid();
            }

            var enrollments = await _context.Enrollments
                .Include(e => e.User)
                .Include(e => e.Payments)
                .Where(e => e.WorkshopCycleId == id)
                .OrderBy(e => e.EnrolledAt)
                .ToListAsync();

            // table rows
            var rows = new List<Dictionary<string, object>>();
            foreach (var e in enrollments)
            {
                var name = ((e.User?.FirstName ?? "") + " " + (e.User?.LastName ?? "")).Trim();
                var paid = (e.Payments != null && e.Payments.Any(p => p.Status == "Paid")) ? "Yes" : "No";
                rows.Add(new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase)
                {
                    ["Name"] = string.IsNullOrWhiteSpace(name) ? (e.User?.Email ?? "") : name,
                    ["Email"] = e.User?.Email ?? string.Empty,
                    ["Paid"] = paid,
                    ["Status"] = e.Status ?? string.Empty,
                    ["EnrolledAt"] = e.EnrolledAt.ToString("yyyy-MM-dd HH:mm"),
                    ["CancelledAt"] = e.CancelledAt?.ToString("yyyy-MM-dd HH:mm") ?? string.Empty
                });
            }

            var doc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(30);
                    page.DefaultTextStyle(x => x.FontSize(10));

                    page.Header().Row(r =>
                    {
                        r.RelativeItem().Text($"Enrollment list for cycle: {cycle.DisplayName ?? ("Cycle " + cycle.Id)}").FontSize(16).SemiBold();
                        r.ConstantItem(140).AlignRight().Text($"Workshop: {cycle.Workshop?.Title ?? ""}").FontSize(10);
                    });

                    page.Content().PaddingVertical(10).Column(col =>
                    {
                        if (rows.Count == 0)
                        {
                            col.Item().Text("No enrollments");
                        }
                        else
                        {
                            var keys = rows[0].Keys.ToList();

                            col.Item().Table(table =>
                            {
                                table.ColumnsDefinition(cd =>
                                {
                                    foreach (var k in keys)
                                        cd.RelativeColumn();
                                });

                                table.Header(header =>
                                {
                                    foreach (var k in keys)
                                        header.Cell().Element(CellStyle).Text(k).SemiBold();
                                });

                                foreach (var row in rows)
                                {
                                    foreach (var k in keys)
                                    {
                                        var txt = row.ContainsKey(k) && row[k] != null ? row[k].ToString() : string.Empty;
                                        table.Cell().Element(CellStyle).Text(txt);
                                    }
                                }
                            });

                            static IContainer CellStyle(IContainer c)
                            {
                                return c.Padding(4).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).AlignLeft();
                            }
                        }
                    });

                    page.Footer().AlignCenter().Text(x => x.Span($"WorkshopHub — generated on {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC").FontSize(9));
                });
            });

            try
            {
                using var ms = new MemoryStream();
                doc.GeneratePdf(ms);
                ms.Position = 0;
                return File(ms.ToArray(), "application/pdf", $"enrollments_cycle_{id}.pdf");
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "PDF_GENERATION_FAILED_ENROLLMENTS", ex.ToString()); } catch { }

                // csv fallback
                try
                {
                    var lines = new List<string>();
                    lines.Add("EnrollmentId,UserId,FirstName,LastName,Email,Paid,Status,EnrolledAt,CancelledAt");
                    foreach (var e in enrollments)
                    {
                        var paid = (e.Payments != null && e.Payments.Any(p => p.Status == "Paid")) ? "Yes" : "No";
                        var csvLine = string.Format("{0},{1},\"{2}\",\"{3}\",\"{4}\",{5},\"{6}\",\"{7}\",\"{8}\"",
                            e.Id,
                            e.UserId,
                            e.User?.FirstName?.Replace("\"", "\"\"") ?? "",
                            e.User?.LastName?.Replace("\"", "\"\"") ?? "",
                            e.User?.Email?.Replace("\"", "\"\"") ?? "",
                            paid,
                            e.Status,
                            e.EnrolledAt.ToString("o"),
                            e.CancelledAt?.ToString("o") ?? ""
                        );
                        lines.Add(csvLine);
                    }

                    var csv = string.Join('\n', lines);
                    var bytes = Encoding.UTF8.GetBytes(csv);
                    Response.Headers.Add("X-PDF-Fallback", "true");
                    return File(bytes, "text/csv", $"enrollments_cycle_{id}_fallback.csv");
                }
                catch (Exception ex2)
                {
                    try { await _audit.LogForHttpAsync(HttpContext, "PDF_AND_CSV_FALLBACK_FAILED_ENROLLMENTS", ex2.ToString()); } catch { }
                    return StatusCode(500, new { error = "Failed to generate PDF and CSV fallback", detail = ex.Message });
                }
            }
        }

        private async Task<bool> TableExistsAsync(string tableName)
        {
            try
            {
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = $"SELECT CASE WHEN OBJECT_ID('dbo.{tableName}','U') IS NOT NULL THEN 1 ELSE 0 END";
                var res = await cmd.ExecuteScalarAsync();
                await conn.CloseAsync();
                return Convert.ToInt32(res) == 1;
            }
            catch
            {
                return false;
            }
        }
    }
}
