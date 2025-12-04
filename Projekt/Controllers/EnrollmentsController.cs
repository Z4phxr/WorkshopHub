using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EnrollmentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;

        public EnrollmentsController(AppDbContext context, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _audit = audit;
        }

        // list all
        [HttpGet]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<ActionResult<IEnumerable<object>>> GetEnrollments()
        {
            var list = await _context.Enrollments
                .Include(e => e.User)
                .Include(e => e.WorkshopCycle).ThenInclude(c => c.Workshop)
                .ToListAsync();
            var enrollments = list.Select(e => new {
                e.Id,
                user = new { e.User.Id, e.User.FirstName, e.User.LastName, e.User.Email },
                cycle = new { e.WorkshopCycle.Id, e.WorkshopCycle.DisplayName },
                workshop = e.WorkshopCycle.Workshop == null ? null : new { e.WorkshopCycle.Workshop.Id, e.WorkshopCycle.Workshop.Title },
                e.EnrolledAt,
                e.Status
            }).ToList();
            return Ok(enrollments);
        }

        // get one
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<ActionResult<object>> GetEnrollment(int id)
        {
            var e2 = await _context.Enrollments
                .Include(en => en.User)
                .Include(en => en.WorkshopCycle).ThenInclude(c => c.Workshop)
                .FirstOrDefaultAsync(en => en.Id == id);
            if (e2 == null) return NotFound();
            return Ok(new {
                e2.Id,
                user = new { e2.User.Id, e2.User.FirstName, e2.User.LastName, e2.User.Email },
                cycle = new { e2.WorkshopCycle.Id, e2.WorkshopCycle.DisplayName },
                workshop = e2.WorkshopCycle.Workshop == null ? null : new { e2.WorkshopCycle.Workshop.Id, e2.WorkshopCycle.Workshop.Title },
                e2.EnrolledAt,
                e2.Status
            });
        }

        // create enrollment
        [HttpPost]
        public async Task<ActionResult<Enrollment>> CreateEnrollment([FromBody] Enrollment request)
        {
            if (request == null) return BadRequest("Empty body.");
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isStaff = User.IsInRole("Admin") || User.IsInRole("Instructor");
            if (!isStaff && currentUserId != request.UserId.ToString()) return Forbid();

            try
            {
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "dbo.sp_RegisterUserToWorkshop";
                cmd.CommandType = CommandType.StoredProcedure;
                var pUser = cmd.CreateParameter(); pUser.ParameterName = "@UserId"; pUser.Value = request.UserId; cmd.Parameters.Add(pUser);
                var pCycle = cmd.CreateParameter(); pCycle.ParameterName = "@WorkshopCycleId"; pCycle.Value = request.WorkshopCycleId; cmd.Parameters.Add(pCycle);

                int? enrollmentId = null; int? paymentId = null; decimal? amount = null;
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        enrollmentId = reader.IsDBNull(reader.GetOrdinal("EnrollmentId")) ? null : reader.GetInt32(reader.GetOrdinal("EnrollmentId"));
                        paymentId = reader.IsDBNull(reader.GetOrdinal("PaymentId")) ? null : reader.GetInt32(reader.GetOrdinal("PaymentId"));
                        amount = reader.IsDBNull(reader.GetOrdinal("Amount")) ? null : reader.GetDecimal(reader.GetOrdinal("Amount"));
                    }
                }
                await conn.CloseAsync();

                if (enrollmentId == null) return StatusCode(500, "Enrollment creation failed unexpectedly.");

                var enrollment = await _context.Enrollments
                    .Include(e => e.WorkshopCycle)
                        .ThenInclude(c => c.Workshop)
                    .Include(e => e.User)
                    .FirstOrDefaultAsync(e => e.Id == enrollmentId.Value);
                if (enrollment == null) return StatusCode(500, "Enrollment created but could not be loaded.");

                return CreatedAtAction(nameof(GetEnrollment), new { id = enrollment.Id }, enrollment);
            }
            catch (SqlException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        public class EnrollCycleDto { public int WorkshopCycleId { get; set; } }

        // join cycle - FIXED: Added transaction with SERIALIZABLE isolation to prevent race conditions
        [HttpPost("join")]
        public async Task<ActionResult<object>> JoinCycle([FromBody] EnrollCycleDto dto)
        {
            if (dto == null) return BadRequest("Empty body.");

            var currentUserIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserIdString) || !int.TryParse(currentUserIdString, out int currentUserId)) 
                return Unauthorized("User not authenticated.");

            // Use transaction with SERIALIZABLE isolation to prevent race conditions
            using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            try
            {
                // Set session context for audit logging
                var conn = _context.Database.GetDbConnection();
                await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);

                // Load cycle with workshop in transaction scope
                var cycle = await _context.WorkshopCycles
                    .Include(c => c.Workshop)
                    .FirstOrDefaultAsync(c => c.Id == dto.WorkshopCycleId);
                
                if (cycle == null || cycle.Workshop == null) 
                {
                    await transaction.RollbackAsync();
                    return BadRequest($"WorkshopCycle with id {dto.WorkshopCycleId} does not exist.");
                }

                if (!cycle.IsOpenForEnrollment) 
                {
                    await transaction.RollbackAsync();
                    return BadRequest("Cycle is closed for enrollment.");
                }

                // Check for duplicate enrollment BEFORE capacity check
                var existing = await _context.Enrollments
                    .FirstOrDefaultAsync(e => e.UserId == currentUserId 
                                           && e.WorkshopCycleId == cycle.Id 
                                           && e.Status != null 
                                           && e.Status.ToUpper() == "ACTIVE");
                
                if (existing != null) 
                {
                    await transaction.RollbackAsync();
                    return BadRequest("You are already enrolled for this cycle.");
                }

                // Check capacity with lock to prevent race condition
                var capacity = cycle.MaxParticipantsOverride ?? cycle.Workshop.MaxParticipants;
                if (capacity > 0)
                {
                    // Count active enrollments within transaction with SERIALIZABLE isolation
                    var activeCount = await _context.Enrollments
                        .CountAsync(e => e.WorkshopCycleId == cycle.Id 
                                      && e.Status != null 
                                      && e.Status.ToUpper() == "ACTIVE");
                    
                    if (activeCount >= capacity) 
                    {
                        await transaction.RollbackAsync();
                        return BadRequest("No seats available for this cycle.");
                    }
                }

                // Create enrollment
                var enrollment = new Enrollment
                {
                    UserId = currentUserId,
                    WorkshopCycleId = cycle.Id,
                    EnrolledAt = DateTime.UtcNow,
                    Status = "Active"
                };
                _context.Enrollments.Add(enrollment);
                await _context.SaveChangesAsync();

                // Create payment if workshop has a price
                var price = cycle.Workshop.Price;
                if (price > 0)
                {
                    var payment = new Payment
                    {
                        EnrollmentId = enrollment.Id,
                        Amount = price,
                        Status = "Pending",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.Payments.Add(payment);
                    await _context.SaveChangesAsync();
                }

                // Commit transaction - all operations succeeded atomically
                await transaction.CommitAsync();

                // Log successful enrollment
                try 
                { 
                    await _audit.LogForHttpAsync(HttpContext, "ENROLLMENT_CREATED_VIA_JOIN", 
                        $"User {currentUserId} enrolled in cycle {cycle.Id} ({cycle.DisplayName})"); 
                } 
                catch { }

                return Ok(new 
                { 
                    message = "Successfully enrolled in cycle.", 
                    enrollmentId = enrollment.Id, 
                    workshopCycleId = cycle.Id 
                });
            }
            catch (Exception ex)
            {
                // Rollback on any error
                try { await transaction.RollbackAsync(); } catch { }
                
                // Log error
                try 
                { 
                    await _audit.LogForHttpAsync(HttpContext, "ENROLLMENT_JOIN_FAILED", 
                        $"Failed to join cycle {dto.WorkshopCycleId}: {ex.Message}"); 
                } 
                catch { }

                // Return appropriate error
                if (ex is DbUpdateException)
                    return Conflict(new { error = "Enrollment conflict", detail = ex.Message });
                
                return StatusCode(500, new { error = "Failed to join cycle", detail = ex.Message });
            }
        }

        // my status
        [HttpGet("my-status/{workshopId}")]
        [Authorize]
        public async Task<ActionResult> GetMyEnrollmentStatus(int workshopId)
        {
            var currentUserIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserIdString) || !int.TryParse(currentUserIdString, out int currentUserId)) return Unauthorized("User not authenticated.");

            var cycleIds = await _context.WorkshopCycles.Where(c => c.WorkshopId == workshopId).Select(c => c.Id).ToListAsync();
            var enrollments = await _context.Enrollments
                .Include(e => e.Payments)
                .Where(e => cycleIds.Contains(e.WorkshopCycleId) && e.UserId == currentUserId && e.Status != null && e.Status.ToUpper() == "ACTIVE")
                .ToListAsync();

            if (enrollments.Count == 0)
                return Ok(new { isEnrolled = false, enrollments = Array.Empty<object>() });

            var result = enrollments.Select(enrollment =>
            {
                var pending = enrollment.Payments?.FirstOrDefault(p => p.Status == "Pending");
                var paid = enrollment.Payments?.Any(p => p.Status == "Paid") ?? false;
                return new
                {
                    id = enrollment.Id,
                    workshopCycleId = enrollment.WorkshopCycleId,
                    enrolledAt = enrollment.EnrolledAt,
                    status = enrollment.Status,
                    hasPendingPayment = pending != null,
                    hasPaidPayment = paid,
                    payment = pending != null ? new { pending.Id, pending.Amount, pending.Status, pending.CreatedAt } : null
                };
            }).ToList();

            return Ok(new { isEnrolled = true, enrollments = result });
        }

        // delete enrollment
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteEnrollment(int id)
        {
            var enrollment = await _context.Enrollments.FindAsync(id);
            if (enrollment == null) return NotFound();
            _context.Enrollments.Remove(enrollment);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // cancel enrollment
        [HttpPut("{id}/cancel")]
        public async Task<IActionResult> CancelEnrollment(int id)
        {
            var enrollment = await _context.Enrollments.FindAsync(id);
            if (enrollment == null) return NotFound();
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var isStaff = User.IsInRole("Admin") || User.IsInRole("Instructor");
            if (!isStaff && currentUserId != enrollment.UserId.ToString()) return Forbid();
            bool cancelledViaProc = false;
            try
            {
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "dbo.sp_CancelEnrollment";
                cmd.CommandType = CommandType.StoredProcedure;
                var p1 = cmd.CreateParameter(); p1.ParameterName = "@EnrollmentId"; p1.Value = id; cmd.Parameters.Add(p1);
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@ActorUserId"; p2.Value = int.TryParse(currentUserId, out var actorId) ? actorId : (object)DBNull.Value; cmd.Parameters.Add(p2);
                var p3 = cmd.CreateParameter(); p3.ParameterName = "@Reason"; p3.Value = DBNull.Value; cmd.Parameters.Add(p3);
                using var reader = await cmd.ExecuteReaderAsync();
                cancelledViaProc = reader.HasRows;
                await conn.CloseAsync();
            }
            catch (Exception)
            {
                cancelledViaProc = false;
            }

            if (!cancelledViaProc)
            {
                enrollment.Status = "Cancelled";
                enrollment.CancelledAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }

        // cancel mine
        [HttpPut("my-enrollment/{cycleId}/cancel")]
        [Authorize]
        public async Task<IActionResult> CancelMyEnrollment(int cycleId)
        {
            var currentUserIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserIdString) || !int.TryParse(currentUserIdString, out int currentUserId)) return Unauthorized("User not authenticated.");

            var enrollment = await _context.Enrollments.FirstOrDefaultAsync(e => e.WorkshopCycleId == cycleId && e.UserId == currentUserId && e.Status == "Active");
            if (enrollment == null) return NotFound("You are not enrolled in this cycle.");

            bool cancelledViaProc = false;
            try
            {
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "dbo.sp_CancelEnrollment";
                cmd.CommandType = CommandType.StoredProcedure;
                var p1 = cmd.CreateParameter(); p1.ParameterName = "@EnrollmentId"; p1.Value = enrollment.Id; cmd.Parameters.Add(p1);
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@ActorUserId"; p2.Value = currentUserId; cmd.Parameters.Add(p2);
                var p3 = cmd.CreateParameter(); p3.ParameterName = "@Reason"; p3.Value = DBNull.Value; cmd.Parameters.Add(p3);
                using var reader = await cmd.ExecuteReaderAsync();
                cancelledViaProc = reader.HasRows;
                await conn.CloseAsync();
            }
            catch (Exception)
            {
                cancelledViaProc = false;
            }

            if (!cancelledViaProc)
            {
                enrollment.Status = "Cancelled";
                enrollment.CancelledAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Successfully cancelled enrollment", enrollmentId = enrollment.Id, proc = cancelledViaProc });
        }

        // my enrollments
        [HttpGet("mine")]
        [Authorize]
        public async Task<IActionResult> GetMyEnrollments()
        {
            var currentUserIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserIdString) || !int.TryParse(currentUserIdString, out int currentUserId)) return Unauthorized("User not authenticated.");

            var enrollments = await _context.Enrollments
                .Where(e => e.UserId == currentUserId)
                .Include(e => e.WorkshopCycle)
                    .ThenInclude(c => c.Sessions)
                .Include(e => e.WorkshopCycle)
                    .ThenInclude(c => c.Workshop)
                .Include(e => e.Payments)
                .OrderByDescending(e => e.EnrolledAt)
                .ToListAsync();

            var result = enrollments.Select(e => new
            {
                enrollmentId = e.Id,
                enrolledAt = e.EnrolledAt,
                status = e.Status,
                workshop = e.WorkshopCycle?.Workshop == null ? null : new { e.WorkshopCycle.Workshop.Id, e.WorkshopCycle.Workshop.Title, e.WorkshopCycle.Workshop.ImageUrl },
                cycle = e.WorkshopCycle == null ? null : new
                {
                    e.WorkshopCycle.Id,
                    e.WorkshopCycle.DisplayName,
                    e.WorkshopCycle.StartDate,
                    e.WorkshopCycle.EndDate,
                    sessions = e.WorkshopCycle.Sessions?.Select(s => new { s.Id, s.Topic, s.StartTime, s.EndTime })
                },
                payments = e.Payments?.Select(p => new { p.Id, p.Amount, p.Status, p.PaidAt, p.CreatedAt })
            }).ToList();

            return Ok(result);
        }

        // mine countdown
        [HttpGet("mine/upcoming-with-countdown")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<object>>> GetMyUpcomingWithCountdown()
        {
            var currentUserIdString = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(currentUserIdString) || !int.TryParse(currentUserIdString, out int userId)) return Unauthorized();

            var results = new List<object>();
            var conn = _context.Database.GetDbConnection();
            try
            {
                await conn.OpenAsync();
                await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);
                var cmd = conn.CreateCommand();
                cmd.CommandText = "sp_GetUpcomingEnrollmentsForUser";
                cmd.CommandType = System.Data.CommandType.StoredProcedure;
                var p = cmd.CreateParameter(); p.ParameterName = "@UserId"; p.Value = userId; cmd.Parameters.Add(p);

                var list = new List<(int? enrollmentId, string? title, DateTime? date)>();
                using (var rdr = await cmd.ExecuteReaderAsync())
                {
                    while (await rdr.ReadAsync())
                    {
                        try
                        {
                            int? enrollmentId = null; string? title = null; DateTime? start = null; DateTime? startTime = null;
                            if (!rdr.IsDBNull(0)) enrollmentId = rdr.GetInt32(0);
                            if (!rdr.IsDBNull(1)) title = rdr.GetString(1);
                            if (!rdr.IsDBNull(2)) start = rdr.GetDateTime(2);
                            if (rdr.FieldCount > 5 && !rdr.IsDBNull(5)) startTime = rdr.GetDateTime(5);
                            var dt = startTime ?? start;
                            list.Add((enrollmentId, title, dt));
                        }
                        catch { continue; }
                    }
                }

                foreach (var item in list)
                {
                    var (enrollmentId, title, date) = item;
                    if (date.HasValue)
                    {
                        int daysUntil;
                        try
                        {
                            var fnCmd = conn.CreateCommand();
                            fnCmd.CommandText = "SELECT dbo.fn_DaysUntil(@dt)";
                            var param = fnCmd.CreateParameter(); param.ParameterName = "@dt"; param.Value = date.Value; fnCmd.Parameters.Add(param);
                            var scalar = await fnCmd.ExecuteScalarAsync();
                            daysUntil = (scalar != null && int.TryParse(scalar.ToString(), out var d)) ? d : (int)(date.Value - DateTime.UtcNow).TotalDays;
                        }
                        catch
                        {
                            daysUntil = (int)(date.Value - DateTime.UtcNow).TotalDays;
                        }
                        var span = date.Value - DateTime.UtcNow;
                        if (span < TimeSpan.Zero) span = TimeSpan.Zero;
                        var totalHours = (int)span.TotalHours;
                        var hours = totalHours % 24;
                        var minutes = span.Minutes;
                        results.Add(new { enrollmentId, title, date, countdown = new { days = daysUntil, hours, minutes } });
                    }
                    else
                    {
                        results.Add(new { enrollmentId, title, date = (DateTime?)null, countdown = (object?)null });
                    }
                }
                return Ok(results);
            }
            catch (SqlException sqlEx)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "UPCOMING_FALLBACK_EF", sqlEx.Message); } catch { }
                try
                {
                    var upcoming = await _context.Enrollments
                        .Where(e => e.UserId == userId && e.Status != null && e.Status.ToUpper() == "ACTIVE")
                        .Include(e => e.WorkshopCycle)
                            .ThenInclude(c => c.Sessions)
                        .Include(e => e.WorkshopCycle)
                            .ThenInclude(c => c.Workshop)
                        .ToListAsync();
                    var fallbackList = upcoming.Select(e =>
                    {
                        DateTime? dt = null;
                        var sessions = e.WorkshopCycle?.Sessions ?? Enumerable.Empty<WorkshopSession>();
                        if (sessions.Any()) dt = sessions.Min(s => s.StartTime);
                        dt ??= e.WorkshopCycle?.StartDate;
                        var title = e.WorkshopCycle?.Workshop?.Title;
                        return (enrollmentId: (int?)e.Id, title, date: dt);
                    }).Where(x => x.date == null || x.date >= DateTime.UtcNow)
                      .OrderBy(x => x.date ?? DateTime.MaxValue)
                      .ToList();
                    foreach (var item in fallbackList)
                    {
                        var (enrollmentId, title, date) = item;
                        if (date.HasValue)
                        {
                            var span = date.Value - DateTime.UtcNow;
                            if (span < TimeSpan.Zero) span = TimeSpan.Zero;
                            var totalHours = (int)span.TotalHours;
                            var hours = totalHours % 24;
                            var minutes = span.Minutes;
                            results.Add(new { enrollmentId, title, date, countdown = new { days = (int)(date.Value - DateTime.UtcNow).TotalDays, hours, minutes } });
                        }
                        else
                        {
                            results.Add(new { enrollmentId, title, date = (DateTime?)null, countdown = (object?)null });
                        }
                    }
                    return Ok(results);
                }
                catch (Exception ex)
                {
                    try { await _audit.LogForHttpAsync(HttpContext, "UNHANDLED_EXCEPTION", ex.ToString()); } catch { }
                    return StatusCode(500, new { error = "Failed to fetch upcoming enrollments", detail = ex.Message });
                }
            }
            finally
            {
                try { await conn.CloseAsync(); } catch { }
            }
        }
    }
}
