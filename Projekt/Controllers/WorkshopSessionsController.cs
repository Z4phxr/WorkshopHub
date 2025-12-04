using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkshopSessionsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;

        public WorkshopSessionsController(AppDbContext context, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _audit = audit;
        }

        // list sessions
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<object>>> GetSessions()
        {
            var list = await _context.WorkshopSessions
                .Include(s => s.WorkshopCycle).ThenInclude(c => c.Workshop)
                .Include(s => s.Address)
                .ToListAsync();

            var sessions = list.Select(s => {
                var wc = s.WorkshopCycle; var w = wc.Workshop;
                int? max = w != null ? (wc.MaxParticipantsOverride ?? (int?)w.MaxParticipants) : null;
                return new
                {
                    s.Id,
                    s.Topic,
                    s.StartTime,
                    s.EndTime,
                    addressOverrideId = s.AddressId,
                    maxParticipants = max,
                    cycle = new { wc.Id, wc.DisplayName, wc.StartDate, wc.EndDate },
                    workshop = w == null ? null : new { w.Id, w.Title }
                };
            }).ToList();
            return Ok(sessions);
        }

        // by workshop
        [HttpGet("workshop/{workshopId}")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<object>>> GetSessionsByWorkshop(int workshopId)
        {
            if (!await _context.Workshops.AnyAsync(w => w.Id == workshopId)) return NotFound("Workshop not found");
            var list2 = await _context.WorkshopSessions
                .Include(s => s.WorkshopCycle).ThenInclude(c => c.Workshop)
                .Include(s => s.Address)
                .Where(s => s.WorkshopCycle.WorkshopId == workshopId)
                .OrderBy(s => s.StartTime)
                .ToListAsync();
            var result = list2.Select(s => {
                var wc = s.WorkshopCycle; var w = wc.Workshop;
                int? max = w != null ? (wc.MaxParticipantsOverride ?? (int?)w.MaxParticipants) : null;
                return new {
                    s.Id,
                    s.Topic,
                    s.StartTime,
                    s.EndTime,
                    addressOverrideId = s.AddressId,
                    maxParticipants = max,
                    cycle = new { wc.Id, wc.DisplayName },
                    workshop = w == null ? null : new { w.Id, w.Title }
                }; }).ToList();
            return Ok(result);
        }

        // by cycle
        [HttpGet("cycle/{cycleId}")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<WorkshopSession>>> GetSessionsByCycle(int cycleId)
        {
            var cycle = await _context.WorkshopCycles.FindAsync(cycleId);
            if (cycle == null) return NotFound("WorkshopCycle not found");

            var sessions = await _context.WorkshopSessions
                .Include(s => s.Address)
                .Where(s => s.WorkshopCycleId == cycleId)
                .OrderBy(s => s.StartTime)
                .ToListAsync();

            return Ok(sessions);
        }

        // get one
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<object>> GetSession(int id)
        {
            var session = await _context.WorkshopSessions
                .Include(s => s.WorkshopCycle)
                    .ThenInclude(c => c.Workshop)
                .Include(s => s.Address)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (session == null) return NotFound();
            var wc = session.WorkshopCycle;
            var w = wc?.Workshop;

            return Ok(new
            {
                session.Id,
                session.Topic,
                session.StartTime,
                session.EndTime,
                addressOverrideId = session.AddressId,
                maxParticipants = wc != null && w != null ? (wc.MaxParticipantsOverride ?? (int?)w.MaxParticipants) : (int?)null,
                workshop = w == null ? null : new { w.Id, w.Title },
                cycle = wc == null ? null : new { wc.Id, wc.DisplayName, wc.StartDate, wc.EndDate }
            });
        }

        // create session
        [HttpPost]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<ActionResult<object>> CreateSession([FromBody] SessionCreateDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var cycle = await _context.WorkshopCycles
                .Include(c => c.Workshop)
                .FirstOrDefaultAsync(c => c.Id == dto.WorkshopCycleId);
            if (cycle == null || cycle.Workshop == null) return BadRequest("WorkshopCycle does not exist.");

            var workshop = cycle.Workshop;

            // validate address
            if (dto.AddressOverrideId.HasValue && await _context.Addresses.FindAsync(dto.AddressOverrideId.Value) == null)
                return BadRequest("Address does not exist.");

            if (dto.EndTime <= dto.StartTime) return BadRequest("EndTime must be after StartTime");

            var session = new WorkshopSession
            {
                WorkshopCycleId = dto.WorkshopCycleId,
                Topic = string.IsNullOrWhiteSpace(dto.Topic) ? null : dto.Topic.Trim(),
                StartTime = dto.StartTime,
                EndTime = dto.EndTime,
                AddressId = dto.AddressOverrideId ?? cycle.AddressId
            };

            _context.WorkshopSessions.Add(session);
            await _context.SaveChangesAsync();

            // LOG: Session created
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.SESSION_CREATED, 
                $"Session ID={session.Id} created for cycle '{cycle.DisplayName}' (ID={cycle.Id}), workshop '{workshop.Title}' (ID={workshop.Id})");

            // update cycle capacity
            if (dto.MaxParticipants.HasValue)
            {
                cycle.MaxParticipantsOverride = dto.MaxParticipants;
                _context.WorkshopCycles.Update(cycle);
                await _context.SaveChangesAsync();
            }

            // update cycle dates
            var times = await _context.WorkshopSessions
                .Where(s => s.WorkshopCycleId == cycle.Id)
                .Select(s => new { s.StartTime, s.EndTime })
                .ToListAsync();
            if (times.Count > 0)
            {
                if (workshop.IsSeries)
                {
                    cycle.StartDate = times.Min(t => t.StartTime);
                    cycle.EndDate = times.Max(t => t.EndTime);
                }
                else
                {
                    cycle.StartDate = session.StartTime;
                    cycle.EndDate = session.EndTime;
                }
                await _context.SaveChangesAsync();
            }

            var created = await _context.WorkshopSessions
                .Include(s => s.WorkshopCycle)
                    .ThenInclude(c => c.Workshop)
                .Include(s => s.Address)
                .Where(s => s.Id == session.Id)
                .Select(s => new
                {
                    s.Id,
                    s.Topic,
                    s.StartTime,
                    s.EndTime,
                    addressOverrideId = s.AddressId,
                    maxParticipants = s.WorkshopCycle != null && s.WorkshopCycle.Workshop != null
                        ? (s.WorkshopCycle.MaxParticipantsOverride ?? (int?)s.WorkshopCycle.Workshop.MaxParticipants)
                        : (int?)null,
                    cycle = s.WorkshopCycle == null ? null : new { s.WorkshopCycle.Id, s.WorkshopCycle.DisplayName }
                })
                .FirstOrDefaultAsync();

            return CreatedAtAction(nameof(GetSession), new { id = session.Id }, created);
        }

        // update session
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<IActionResult> UpdateSession(int id, [FromBody] SessionUpdateDto dto)
        {
            if (id != dto.Id) return BadRequest("Ids do not match");
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (dto.EndTime <= dto.StartTime) return BadRequest("EndTime must be after StartTime");

            var existing = await _context.WorkshopSessions
                .Include(s => s.WorkshopCycle)
                    .ThenInclude(c => c.Workshop)
                .Include(s => s.Address)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (existing == null) return NotFound("Session not found");

            // use included nav
            var cycle = existing.WorkshopCycle;
            var workshop = cycle?.Workshop;
            if (cycle == null || workshop == null) return BadRequest("WorkshopCycle does not exist.");

            // validate address
            if (dto.AddressOverrideId.HasValue && await _context.Addresses.FindAsync(dto.AddressOverrideId.Value) == null)
                return BadRequest("Address does not exist");

            existing.Topic = string.IsNullOrWhiteSpace(dto.Topic) ? (cycle.DisplayName ?? workshop.Title) : dto.Topic.Trim();
            existing.StartTime = dto.StartTime;
            existing.EndTime = dto.EndTime;
            existing.AddressId = dto.AddressOverrideId ?? cycle.AddressId ?? workshop.AddressId;

            // update cycle capacity
            if (dto.MaxParticipants.HasValue)
            {
                cycle.MaxParticipantsOverride = dto.MaxParticipants;
                _context.WorkshopCycles.Update(cycle);
            }

            await _context.SaveChangesAsync();
            
            // LOG: Session updated
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.SESSION_UPDATED, 
                $"Session ID={id} updated for cycle '{cycle.DisplayName}' (ID={cycle.Id})");

            // update cycle dates
            var times2 = await _context.WorkshopSessions
                .Where(s => s.WorkshopCycleId == cycle.Id)
                .Select(s => new { s.StartTime, s.EndTime })
                .ToListAsync();
            if (times2.Count > 0)
            {
                if (workshop.IsSeries)
                {
                    cycle.StartDate = times2.Min(t => t.StartTime);
                    cycle.EndDate = times2.Max(t => t.EndTime);
                }
                else
                {
                    cycle.StartDate = existing.StartTime;
                    cycle.EndDate = existing.EndTime;
                }
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }

        // delete session
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<IActionResult> DeleteSession(int id)
        {
            var existing = await _context.WorkshopSessions
                .Include(s => s.WorkshopCycle)
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id);
            if (existing == null) return NotFound();

            var cycleInfo = existing.WorkshopCycle != null 
                ? $"cycle '{existing.WorkshopCycle.DisplayName}' (ID={existing.WorkshopCycle.Id})" 
                : "unknown cycle";

            try
            {
                // Use raw SQL DELETE so triggers have access to SESSION_CONTEXT
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                try
                {
                    // Set SESSION_CONTEXT so triggers can log UserId
                    await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);
                    
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "DELETE FROM dbo.WorkshopSessions WHERE Id = @id";
                    var p = cmd.CreateParameter();
                    p.ParameterName = "@id";
                    p.Value = id;
                    cmd.Parameters.Add(p);
                    
                    var affected = await cmd.ExecuteNonQueryAsync();
                    if (affected == 0) return NotFound();
                }
                finally
                {
                    try { await conn.CloseAsync(); } catch { }
                }
                
                // LOG: Session deleted
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.SESSION_DELETED, 
                    $"Session ID={id} deleted from {cycleInfo}");
                
                return NoContent();
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to delete session ID={id}: {ex.Message}");
                return StatusCode(500, new { error = "Failed to delete session", detail = ex.Message });
            }
        }

        public class SessionCreateDto
        {
            [Required]
            public int WorkshopCycleId { get; set; }

            public string? Topic { get; set; }

            [Required]
            public DateTime StartTime { get; set; }

            [Required]
            public DateTime EndTime { get; set; }

            [System.Text.Json.Serialization.JsonPropertyName("addressId")]
            public int? AddressOverrideId { get; set; }
            [System.Text.Json.Serialization.JsonPropertyName("maxParticipants")]
            public int? MaxParticipants { get; set; }
        }

        public class SessionUpdateDto
        {
            [Required]
            public int Id { get; set; }

            public string? Topic { get; set; }

            [Required]
            public DateTime StartTime { get; set; }

            [Required]
            public DateTime EndTime { get; set; }

            [System.Text.Json.Serialization.JsonPropertyName("addressId")]
            public int? AddressOverrideId { get; set; }
            [System.Text.Json.Serialization.JsonPropertyName("maxParticipants")]
            public int? MaxParticipants { get; set; }
        }
    }
}
