#pragma warning disable CS8602
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using System.Data;
using Microsoft.Data.SqlClient;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims; // added for claim access

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkshopsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;
        private readonly Projekt.Services.IAuditLogger _audit;

        public WorkshopsController(AppDbContext context, IWebHostEnvironment env, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _env = env;
            _audit = audit;
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

        private ActionResult<T> ServiceUnavailableBecauseMissingSchema<T>(string tableName)
        {
            var obj = new ObjectResult(new { error = $"Database schema not ready: missing table {tableName}. Apply migrations (dotnet ef database update) or ensure the application has run migrations at startup." }) { StatusCode = 503 };
            return new ActionResult<T>(obj);
        }

        private class SessionDto
        {
            public int Id { get; set; }
            public string? Topic { get; set; }
            public DateTime StartTime { get; set; }
            public DateTime EndTime { get; set; }
            public int? AddressId { get; set; }
            public int WorkshopCycleId { get; set; }
        }

        // GET: api/workshops
        // public – anyone can browse available workshops
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<object>>> GetWorkshops([FromQuery] int? categoryId = null)
        {
            if (!await TableExistsAsync("Workshops"))
                return ServiceUnavailableBecauseMissingSchema<IEnumerable<object>>("Workshops");

            try
            {
                var query = _context.Workshops
                    .Include(w => w.Category)
                    .Include(w => w.Address)
                    .Include(w => w.DefaultInstructor)
                    .Include(w => w.Cycles)
                    .AsQueryable();

                if (categoryId.HasValue && categoryId.Value > 0)
                {
                    query = query.Where(w => w.CategoryId == categoryId.Value);
                }

                var workshops = await query.ToListAsync();

                // fetch workshop-level instructor assignments
                var workshopIds = workshops.Select(w => w.Id).ToList();
                var assignments = new List<InstructorAssignment>();
                if (workshopIds.Count > 0 && await TableExistsAsync("InstructorAssignments"))
                {
                    assignments = await _context.InstructorAssignments
                        .Where(a => a.WorkshopId != null && workshopIds.Contains(a.WorkshopId.Value))
                        .Include(a => a.Instructor)
                        .ToListAsync();
                }
                var byWorkshop = assignments.GroupBy(a => a.WorkshopId).ToDictionary(g => g.Key!.Value, g => g.ToList());

                var sanitized = workshops.Select(w => {
                    var instructors = (byWorkshop.TryGetValue(w.Id, out var list)
                        ? list.Where(a => w.DefaultInstructorId == null || a.InstructorId != w.DefaultInstructorId)
                               .Select(i => new { i.InstructorId, instructor = i.Instructor == null ? null : new { i.Instructor.Id, i.Instructor.FirstName, i.Instructor.LastName, i.Instructor.Email } })
                        : null);
                    return new {
                        w.Id,
                        w.Title,
                        w.Description,
                        w.IsSeries,
                        w.Price,
                        w.MaxParticipants,
                        w.AverageRating,
                        w.ImageUrl,
                        w.ThumbnailUrl,
                        Category = w.Category,
                        Address = w.Address,
                        DefaultInstructor = w.DefaultInstructor == null ? null : new { w.DefaultInstructor.Id, w.DefaultInstructor.FirstName, w.DefaultInstructor.LastName, w.DefaultInstructor.Email },
                        Instructors = instructors,
                        UpcomingCycles = (w.Cycles ?? Enumerable.Empty<WorkshopCycle>())
                            .Where(c => c.IsOpenForEnrollment && (c.EndDate == null || c.EndDate >= DateTime.UtcNow))
                            .Select(c => new { c.Id, c.DisplayName, c.StartDate, c.EndDate })
                            .ToList()
                    }; });
                return Ok(sanitized);
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "WORKSHOPS_LIST_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch workshops", details = ex.ToString() });
            }
        }

        // NEW: GET: api/workshops/mine
        // Returns workshops where the current user is the default instructor or has an instructor assignment
        [HttpGet("mine")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<ActionResult<IEnumerable<object>>> GetMyWorkshops()
        {
            if (!await TableExistsAsync("Workshops"))
                return ServiceUnavailableBecauseMissingSchema<IEnumerable<object>>("Workshops");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId)) return Unauthorized();

            try
            {
                // find workshop ids where user is default instructor
                var q = _context.Workshops
                    .Include(w => w.Category)
                    .Include(w => w.Address)
                    .Include(w => w.DefaultInstructor)
                    .Include(w => w.Cycles)
                    .AsQueryable();

                // gather workshop ids assigned via InstructorAssignments as well
                var assignedWorkshopIds = new List<int>();
                if (await TableExistsAsync("InstructorAssignments"))
                {
                    assignedWorkshopIds = await _context.InstructorAssignments
                        .Where(a => a.InstructorId == userId && a.WorkshopId != null)
                        .Select(a => a.WorkshopId!.Value)
                        .Distinct()
                        .ToListAsync();
                }

                q = q.Where(w => w.DefaultInstructorId == userId || assignedWorkshopIds.Contains(w.Id));

                var workshops = await q.ToListAsync();

                // fetch workshop-level instructor assignments
                var workshopIds = workshops.Select(w => w.Id).ToList();
                var assignments = new List<InstructorAssignment>();
                if (workshopIds.Count > 0 && await TableExistsAsync("InstructorAssignments"))
                {
                    assignments = await _context.InstructorAssignments
                        .Where(a => a.WorkshopId != null && workshopIds.Contains(a.WorkshopId.Value))
                        .Include(a => a.Instructor)
                        .ToListAsync();
                }
                var byWorkshop = assignments.GroupBy(a => a.WorkshopId).ToDictionary(g => g.Key!.Value, g => g.ToList());

                var sanitized = workshops.Select(w => {
                    var instructors = (byWorkshop.TryGetValue(w.Id, out var list)
                        ? list.Where(a => w.DefaultInstructorId == null || a.InstructorId != w.DefaultInstructorId)
                               .Select(i => new { i.InstructorId, instructor = i.Instructor == null ? null : new { i.Instructor.Id, i.Instructor.FirstName, i.Instructor.LastName, i.Instructor.Email } })
                        : null);
                    return new {
                        w.Id,
                        w.Title,
                        w.Description,
                        w.IsSeries,
                        w.Price,
                        w.MaxParticipants,
                        w.AverageRating,
                        w.ImageUrl,
                        w.ThumbnailUrl,
                        Category = w.Category,
                        Address = w.Address,
                        DefaultInstructor = w.DefaultInstructor == null ? null : new { w.DefaultInstructor.Id, w.DefaultInstructor.FirstName, w.DefaultInstructor.LastName, w.DefaultInstructor.Email },
                        Instructors = instructors,
                        UpcomingCycles = (w.Cycles ?? Enumerable.Empty<WorkshopCycle>())
                            .Where(c => c.IsOpenForEnrollment && (c.EndDate == null || c.EndDate >= DateTime.UtcNow))
                            .Select(c => new { c.Id, c.DisplayName, c.StartDate, c.EndDate })
                            .ToList()
                    }; }).ToList();

                return Ok(sanitized);
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "WORKSHOPS_MINE_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch instructor workshops", details = ex.ToString() });
            }
        }

        // GET: api/workshops/5
        // public – details + cycles
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<object>> GetWorkshop(int id)
        {
            if (!await TableExistsAsync("Workshops"))
                return ServiceUnavailableBecauseMissingSchema<object>("Workshops");

            try
            {
                var workshop = await _context.Workshops
                    .Include(w => w.Category)
                    .Include(w => w.Address)
                    .Include(w => w.DefaultInstructor)
                    .FirstOrDefaultAsync(w => w.Id == id);

                if (workshop == null)
                    return NotFound();

                // Fetch cycles (minimal projection) and sessions separately to avoid complex JOINs that produce invalid column aliases
                if (!await TableExistsAsync("WorkshopCycles"))
                    return ServiceUnavailableBecauseMissingSchema<object>("WorkshopCycles");

                var cyclesRaw = await _context.WorkshopCycles
                    .Where(c => c.WorkshopId == id)
                    .Select(c => new {
                        c.Id,
                        c.DisplayName,
                        c.StartDate,
                        c.EndDate,
                        c.IsOpenForEnrollment,
                        MaxParticipantsOverride = c.MaxParticipantsOverride,
                        AddressId = c.AddressId,
                        InstructorOverrideId = c.InstructorOverrideId
                    })
                    .AsNoTracking()
                    .ToListAsync();

                var cycleIds = cyclesRaw.Select(c => c.Id).ToList();

                // Fetch sessions for all cycles in one simple query
                var sessionsRaw = new List<SessionDto>();
                if (cycleIds.Count > 0 && await TableExistsAsync("WorkshopSessions"))
                {
                    sessionsRaw = await _context.WorkshopSessions
                        .Where(s => cycleIds.Contains(s.WorkshopCycleId))
                        .Select(s => new SessionDto {
                            Id = s.Id,
                            Topic = s.Topic,
                            StartTime = s.StartTime,
                            EndTime = s.EndTime,
                            AddressId = s.AddressId,
                            WorkshopCycleId = s.WorkshopCycleId
                        })
                        .AsNoTracking()
                        .ToListAsync();
                }

                var sessionIds = sessionsRaw.Select(s => s.Id).ToList();

                var assignments = new List<InstructorAssignment>();
                if (await TableExistsAsync("InstructorAssignments"))
                {
                    assignments = await _context.InstructorAssignments
                        .Where(a => (a.WorkshopId != null && a.WorkshopId == id)
                                    || (a.WorkshopCycleId != null && cycleIds.Contains(a.WorkshopCycleId.Value))
                                    || (a.WorkshopSessionId != null && sessionIds.Contains(a.WorkshopSessionId.Value)))
                        .Include(a => a.Instructor)
                        .AsNoTracking()
                        .ToListAsync();
                }

                // workshopLevel assignments excluding duplicate default instructor and omitting IsLead flag
                var workshopLevel = assignments
                    .Where(a => a.WorkshopId == id && (workshop.DefaultInstructorId == null || a.InstructorId != workshop.DefaultInstructorId))
                    .Select(a => new { a.InstructorId, instructor = a.Instructor == null ? null : new { a.Instructor.Id, a.Instructor.FirstName, a.Instructor.LastName, a.Instructor.Email } });

                // compute active enrollment counts per cycle
                var cycleIdsForEnrollments = workshop.Cycles?.Select(c => c.Id).ToList() ?? new List<int>();
                var enrollmentCounts = new Dictionary<int,int>();
                if (cycleIdsForEnrollments.Count > 0 && await TableExistsAsync("Enrollments"))
                {
                    var counts = await _context.Enrollments
                        .Where(e => cycleIdsForEnrollments.Contains(e.WorkshopCycleId) && e.Status != null && e.Status.ToUpper() == "ACTIVE")
                        .GroupBy(e => e.WorkshopCycleId)
                        .Select(g => new { CycleId = g.Key, Count = g.Count() })
                        .ToListAsync();
                    enrollmentCounts = counts.ToDictionary(x => x.CycleId, x => x.Count);
                }

                // assemble cycles combining cyclesRaw and sessionsRaw
                var sessionsByCycle = sessionsRaw.GroupBy(s => s.WorkshopCycleId).ToDictionary(g => g.Key, g => g.ToList());

                var cycles = cyclesRaw.Select(c => {
                    var cid = c.Id;
                    var sessionsForCycle = sessionsByCycle.TryGetValue(cid, out var lst) ? lst : new List<SessionDto>();
                    return new
                    {
                        Id = cid,
                        DisplayName = c.DisplayName,
                        StartDate = c.StartDate,
                        EndDate = c.EndDate,
                        IsOpenForEnrollment = c.IsOpenForEnrollment,
                        // effective maxParticipants: cycle override -> workshop default
                        effectiveMaxParticipants = c.MaxParticipantsOverride ?? workshop.MaxParticipants,
                        // expose address using override when present
                        AddressId = c.AddressId ?? workshop.AddressId,
                        activeEnrollments = enrollmentCounts.TryGetValue(cid, out var ec) ? ec : 0,
                        instructors = assignments.Where(a => a.WorkshopCycleId == cid && (workshop.DefaultInstructorId == null || a.InstructorId != workshop.DefaultInstructorId))
                            .Select(a => new { a.InstructorId, instructor = a.Instructor == null ? null : new { a.Instructor.Id, a.Instructor.FirstName, a.Instructor.LastName, a.Instructor.Email } }),
                        sessions = sessionsForCycle.Select(s => new {
                            s.Id,
                            s.Topic,
                            s.StartTime,
                            s.EndTime,
                            // prefer session override then cycle override then workshop default
                            addressId = s.AddressId ?? c.AddressId ?? workshop.AddressId,
                            // session-level MaxParticipants removed; report cycle-level capacity instead
                            maxParticipants = c.MaxParticipantsOverride ?? workshop.MaxParticipants,
                            instructors = assignments.Where(a => a.WorkshopSessionId == s.Id && (workshop.DefaultInstructorId == null || a.InstructorId != workshop.DefaultInstructorId))
                                .Select(a => new { a.InstructorId, instructor = a.Instructor == null ? null : new { a.Instructor.Id, a.Instructor.FirstName, a.Instructor.LastName, a.Instructor.Email } })
                        })
                    }; }).ToList();

                return Ok(new
                {
                    workshop.Id,
                    workshop.Title,
                    workshop.Description,
                    workshop.IsSeries,
                    workshop.Price,
                    workshop.MaxParticipants,
                    workshop.AverageRating,
                    workshop.ImageUrl,
                    workshop.ThumbnailUrl,
                    Category = workshop.Category,
                    Address = workshop.Address,
                    DefaultInstructor = workshop.DefaultInstructor == null ? null : new { workshop.DefaultInstructor.Id, workshop.DefaultInstructor.FirstName, workshop.DefaultInstructor.LastName, workshop.DefaultInstructor.Email },
                    Instructors = workshopLevel,
                    Cycles = cycles
                });
            }
            catch(Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "WORKSHOP_FETCH_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch workshop", details = ex.ToString() });
            }
        }

        // GET: api/workshops/5/availability
        // Public endpoint - shows workshop with cycles and aggregated stats
        [HttpGet("{id}/availability")]
        [AllowAnonymous]
        public async Task<ActionResult> GetWorkshopAvailability(int id)
        {
            var workshop = await _context.Workshops
                .Include(w => w.Category)
                .Include(w => w.Address)
                .Include(w => w.Cycles)
                    .ThenInclude(c => c.Sessions)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (workshop == null)
                return NotFound();

            // Compute stats across ALL cycles (same as Admin details) to keep numbers consistent
            var cycleIds = await _context.WorkshopCycles
                .Where(c => c.WorkshopId == id)
                .Select(c => c.Id)
                .ToListAsync();

            var totalActiveEnrollments = await _context.Enrollments
                .CountAsync(e => cycleIds.Contains(e.WorkshopCycleId) && e.Status != null && e.Status.ToUpper() == "ACTIVE");

            var defaultMax = workshop.MaxParticipants;
            var totalMax = await _context.WorkshopCycles
                .Where(c => c.WorkshopId == id)
                .SumAsync(c => c.MaxParticipantsOverride ?? defaultMax);

            var availableSeats = totalMax > 0 ? totalMax - totalActiveEnrollments : -1;
            var isFull = totalMax > 0 && totalActiveEnrollments >= totalMax;

            return Ok(new
            {
                workshop = new
                {
                    workshop.Id,
                    workshop.Title,
                    workshop.Description,
                    workshop.IsSeries,
                    workshop.Price,
                    workshop.MaxParticipants,
                    workshop.AverageRating,
                    workshop.ImageUrl,
                    workshop.ThumbnailUrl,
                    category = workshop.Category?.Name,
                    address = workshop.Address != null ? new
                    {
                        workshop.Address.City,
                        workshop.Address.Street,
                        workshop.Address.BuildingNumber,
                        workshop.Address.Room
                    } : null,
                    sessions = new List<object>() // legacy field kept for frontend compatibility but deprecated
                },
                stats = new
                {
                    activeEnrollments = totalActiveEnrollments,
                    availableSeats,
                    isFull
                }
            });
        }

        // GET: api/workshops/5/details
        // Admin/Instructor - detailed view with enrolled users (per workshop cycles)
        [HttpGet("{id}/details")]
        [Authorize(Roles = "Admin,Instructor")]
        public async Task<ActionResult> GetWorkshopDetails(int id)
        {
            var workshop = await _context.Workshops
                .Include(w => w.Category)
                .Include(w => w.Address)
                .Include(w => w.Cycles)
                .FirstOrDefaultAsync(w => w.Id == id);

            if (workshop == null)
                return NotFound();

            var cycleIds = await _context.WorkshopCycles
                .Where(c => c.WorkshopId == id)
                .Select(c => c.Id)
                .ToListAsync();

            var enrollments = await _context.Enrollments
                .Include(e => e.User)
                .Include(e => e.WorkshopCycle)
                .Where(e => cycleIds.Contains(e.WorkshopCycleId) && e.Status != null && e.Status.ToUpper() == "ACTIVE")
                .Select(e => new
                {
                    enrollmentId = e.Id,
                    userId = e.User != null ? e.User.Id : 0,
                    firstName = e.User != null ? e.User.FirstName : string.Empty,
                    lastName = e.User != null ? e.User.LastName : string.Empty,
                    email = e.User != null ? e.User.Email : string.Empty,
                    enrolledAt = e.EnrolledAt,
                    status = e.Status
                })
                .ToListAsync();

            var activeEnrollments = enrollments.Count;
            var defaultMax = workshop.MaxParticipants;
            var totalMax = await _context.WorkshopCycles
                .Where(c => c.WorkshopId == id)
                .SumAsync(c => c.MaxParticipantsOverride ?? defaultMax);

            var availableSeats = totalMax > 0 ? totalMax - activeEnrollments : -1;

            return Ok(new
            {
                workshop = new
                {
                    workshop.Id,
                    workshop.Title,
                    workshop.Description,
                    workshop.IsSeries,
                    workshop.Price,
                    workshop.MaxParticipants,
                    workshop.AverageRating,
                    workshop.ImageUrl,
                    workshop.ThumbnailUrl,
                    category = workshop.Category?.Name,
                    address = workshop.Address != null ? new
                    {
                        workshop.Address.City,
                        workshop.Address.Street,
                        workshop.Address.BuildingNumber,
                        workshop.Address.Room
                    } : null,
                    sessionsCount = 0 // deprecated in favor of cycles
                },
                stats = new
                {
                    activeEnrollments,
                    availableSeats,
                    isFull = totalMax > 0 && activeEnrollments >= totalMax
                },
                enrolledUsers = enrollments
            });
        }

        public class WorkshopCreateDto
        {
            [Required]
            [StringLength(200)]
            public string Title { get; set; } = string.Empty;
            [StringLength(4000)]
            public string? Description { get; set; }
            public bool IsSeries { get; set; }
            [Range(0, 100000)]
            public decimal Price { get; set; }
            [Range(1, 10000)]
            public int MaxParticipants { get; set; }
            [Range(1, int.MaxValue)]
            public int CategoryId { get; set; }
            [Range(1, int.MaxValue)]
            public int AddressId { get; set; }
            [Url]
            public string? ImageUrl { get; set; } // optional direct URL
            public IFormFile? ImageFile { get; set; } // optional uploaded file (multipart/form-data)
            [Range(1, int.MaxValue)]
            public int InstructorId { get; set; }
        }

        public class WorkshopUpdateDto : WorkshopCreateDto
        {
            [Range(1, int.MaxValue)]
            public int Id { get; set; }
        }

        // POST: api/workshops
        // Now supports multipart/form-data with an ImageFile
        [HttpPost]
        [Authorize(Roles = "Admin")] // restricted to Admin only
        public async Task<ActionResult<Workshop>> CreateWorkshop([FromForm] WorkshopCreateDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(dto.Title))
                return BadRequest("Title is required.");

            if (await _context.Categories.FindAsync(dto.CategoryId) == null)
                return BadRequest("Category does not exist.");
            if (await _context.Addresses.FindAsync(dto.AddressId) == null)
                return BadRequest("Address does not exist.");

            // Validate instructor (required)
            var instr = await _context.Users
                .Include(u => u.UserRoles!)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == dto.InstructorId);
            if (instr == null) return BadRequest("Instructor does not exist");
            var isInstructor = instr.UserRoles?.Any(r => r.Role.Name == "Instructor") ?? false;
            if (!isInstructor) return BadRequest("Selected user is not an Instructor");

            // Prevent accidental duplicate workshop creation (same title + same address)
            var normalizedTitle = dto.Title.Trim().ToLowerInvariant();
            var exists = await _context.Workshops.AnyAsync(w => w.Title.ToLower() == normalizedTitle && w.AddressId == dto.AddressId);
            if (exists)
                return Conflict("A workshop with the same title and address already exists.");

            string? storedImageUrl = null;
            if (dto.ImageFile != null && dto.ImageFile.Length > 0)
            {
                var folder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "workshop-images");
                if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);
                var ext = Path.GetExtension(dto.ImageFile.FileName);
                if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
                var fileName = $"{Guid.NewGuid():N}{ext}";
                var physPath = Path.Combine(folder, fileName);
                await using (var stream = System.IO.File.Create(physPath))
                {
                    await dto.ImageFile.CopyToAsync(stream);
                }
                storedImageUrl = $"/workshop-images/{fileName}";
            }
            else if (!string.IsNullOrWhiteSpace(dto.ImageUrl))
            {
                storedImageUrl = dto.ImageUrl.Trim();
            }

            var workshop = new Workshop
            {
                Title = dto.Title.Trim(),
                Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                IsSeries = dto.IsSeries,
                Price = dto.Price,
                MaxParticipants = dto.MaxParticipants,
                CategoryId = dto.CategoryId,
                AddressId = dto.AddressId,
                AverageRating = 0,
                ImageUrl = storedImageUrl,
                ThumbnailUrl = storedImageUrl,
                DefaultInstructorId = dto.InstructorId
            };

            _context.Workshops.Add(workshop);
            await _context.SaveChangesAsync();

            // Add lead instructor via InstructorAssignment
            _context.InstructorAssignments.Add(new InstructorAssignment { WorkshopId = workshop.Id, InstructorId = dto.InstructorId, IsLead = true });
            await _context.SaveChangesAsync();

            // LOG: Workshop created
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.WORKSHOP_CREATED, 
                $"Workshop '{workshop.Title}' (ID={workshop.Id}) created with instructor {instr.Email} (ID={dto.InstructorId})");

            var created = await _context.Workshops
                .Include(w => w.Category)
                .Include(w => w.Address)
                .Include(w => w.DefaultInstructor)
                .FirstOrDefaultAsync(w => w.Id == workshop.Id);

            return CreatedAtAction(nameof(GetWorkshop), new { id = workshop.Id }, created);
        }

        // PUT: api/workshops/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Instructor")] // allow Instructors but validate ownership
        public async Task<IActionResult> UpdateWorkshop(int id, [FromBody] WorkshopUpdateDto dto)
        {
            // only Admins or assigned/default instructor may update
            if (!User.IsInRole("Admin"))
            {
                var userId = GetCurrentUserId();
                if (!await IsUserInstructorForWorkshop(userId, id)) return Forbid();
            }

            if (id != dto.Id)
                return BadRequest("Ids do not match.");

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(dto.Title))
                return BadRequest("Title is required.");

            var existing = await _context.Workshops.FindAsync(id);
            if (existing == null)
                return NotFound();

            if (await _context.Categories.FindAsync(dto.CategoryId) == null)
                return BadRequest("Category does not exist.");
            if (await _context.Addresses.FindAsync(dto.AddressId) == null)
                return BadRequest("Address does not exist.");

            // Validate instructor (required)
            var instr2 = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == dto.InstructorId);
            if (instr2 == null) return BadRequest("Instructor does not exist");
            var isInstr2 = (instr2.UserRoles ?? new List<UserRole>()).Any(r => r.Role != null && r.Role.Name == "Instructor");
            if (!isInstr2) return BadRequest("Selected user is not an Instructor");

            var oldTitle = existing.Title;
            existing.Title = dto.Title.Trim();
            existing.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            existing.IsSeries = dto.IsSeries;
            existing.Price = dto.Price;
            existing.MaxParticipants = dto.MaxParticipants;
            existing.CategoryId = dto.CategoryId;
            existing.AddressId = dto.AddressId;
            existing.DefaultInstructorId = dto.InstructorId;
            if (!string.IsNullOrWhiteSpace(dto.ImageUrl))
            {
                existing.ImageUrl = dto.ImageUrl.Trim();
                existing.ThumbnailUrl = dto.ImageUrl.Trim();
            }
            await _context.SaveChangesAsync();
            
            // LOG: Workshop updated
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.WORKSHOP_UPDATED, 
                $"Workshop ID={id} updated: '{oldTitle}' → '{existing.Title}', instructor={instr2.Email} (ID={dto.InstructorId})");
            
            return NoContent();
        }

        // DELETE: api/workshops/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Instructor")] // allow instructor if they own the workshop
        public async Task<IActionResult> DeleteWorkshop(int id)
        {
            // only Admins or assigned/default instructor may delete
            if (!User.IsInRole("Admin"))
            {
                var userId = GetCurrentUserId();
                if (!await IsUserInstructorForWorkshop(userId, id)) return Forbid();
            }

            var workshop = await _context.Workshops
                .Include(w => w.Cycles)
                .AsNoTracking()
                .FirstOrDefaultAsync(w => w.Id == id);
            if (workshop == null)
                return NotFound();

            var workshopTitle = workshop.Title;
            var cyclesCount = workshop.Cycles?.Count ?? 0;

            try
            {
                // Get counts for detailed logging BEFORE delete
                var enrollmentCount = 0;
                var paymentCount = 0;
                var sessionCount = 0;
                
                if (cyclesCount > 0)
                {
                    var cycleIds = workshop.Cycles!.Select(c => c.Id).ToList();
                    enrollmentCount = await _context.Enrollments.CountAsync(e => cycleIds.Contains(e.WorkshopCycleId));
                    
                    if (enrollmentCount > 0)
                    {
                        var enrollmentIds = await _context.Enrollments
                            .Where(e => cycleIds.Contains(e.WorkshopCycleId))
                            .Select(e => e.Id)
                            .ToListAsync();
                        paymentCount = await _context.Payments.CountAsync(p => enrollmentIds.Contains(p.EnrollmentId));
                    }
                    
                    sessionCount = await _context.WorkshopSessions.CountAsync(s => cycleIds.Contains(s.WorkshopCycleId));
                }

                // Use raw SQL
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                try
                {
                    await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "DELETE FROM dbo.Workshops WHERE Id = @id";
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
                
                // LOG: Workshop deleted with cascade info
                var details = $"Workshop '{workshopTitle}' (ID={id}) deleted with {cyclesCount} cycles, " +
                              $"{enrollmentCount} enrollments, {paymentCount} payments, {sessionCount} sessions " +
                              $"(all cascade deleted)";
                
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.WORKSHOP_DELETED, details);
                
                return NoContent();
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to delete workshop ID={id}: {ex.Message}");
                return StatusCode(500, new { error = "Failed to delete workshop", detail = ex.Message });
            }
        }

        // POST: api/workshops/5/image
        [HttpPost("{id}/image")]
        [Authorize(Roles = "Admin,Instructor")] // allow instructor to upload image for workshops they manage
        public async Task<ActionResult> UploadImage(int id, IFormFile file)
        {
            if (!User.IsInRole("Admin"))
            {
                var userId = GetCurrentUserId();
                if (!await IsUserInstructorForWorkshop(userId, id)) return Forbid();
            }

            var workshop = await _context.Workshops.FindAsync(id);
            if (workshop == null) return NotFound();
            if (file == null || file.Length == 0) return BadRequest("No file uploaded");

            var folder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "workshop-images");
            if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);

            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
            var fileName = $"{Guid.NewGuid():N}{ext}";
            var physPath = Path.Combine(folder, fileName);
            await using (var stream = System.IO.File.Create(physPath))
            {
                await file.CopyToAsync(stream);
            }
            var relUrl = $"/workshop-images/{fileName}";

            workshop.ImageUrl = relUrl;
            workshop.ThumbnailUrl = relUrl;
            await _context.SaveChangesAsync();
            
            // LOG: Image uploaded
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.WORKSHOP_IMAGE_UPLOADED, 
                $"Image uploaded for workshop '{workshop.Title}' (ID={id}): {relUrl}");
            
            return Ok(new { imageUrl = relUrl });
        }

        // GET: api/workshops/5/reviews
        // Paginated reviews for a given workshop. sort can be 'recent' (default) or 'rating'
        [HttpGet("{id}/reviews")]
        [AllowAnonymous]
        public async Task<IActionResult> GetReviewsForWorkshop(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string sort = "recent")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 100) pageSize = 10;

            var exists = await _context.Workshops.AnyAsync(w => w.Id == id);
            if (!exists) return NotFound("Workshop not found");

            var q = _context.Reviews
                .Include(r => r.User)
                .Where(r => r.WorkshopId == id);

            var total = await q.CountAsync();

            // sorting
            if (string.Equals(sort, "rating", StringComparison.OrdinalIgnoreCase))
            {
                q = q.OrderByDescending(r => r.Rating).ThenByDescending(r => r.CreatedAt);
            }
            else
            {
                q = q.OrderByDescending(r => r.CreatedAt);
            }

            var items = await q
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new
                {
                    r.Id,
                    r.Rating,
                    r.Comment,
                    r.CreatedAt,
                    user = r.User == null ? null : new { r.User.Id, r.User.FirstName, r.User.LastName }
                })
                .ToListAsync();

            return Ok(new { total, page, pageSize, items });
        }

        // GET: api/workshops/popular
        // Returns top N workshops by total enrollments across all cycles
        [HttpGet("popular")]
        [AllowAnonymous]
        public async Task<ActionResult<object>> GetPopularWorkshops([FromQuery] int count = 4)
        {
            if (!await TableExistsAsync("Workshops"))
                return ServiceUnavailableBecauseMissingSchema<object>("Workshops");

            try
            {
                if (!await TableExistsAsync("WorkshopCycles") || !await TableExistsAsync("Enrollments"))
                {
                    // If cycles or enrollments table missing, return empty list
                    return Ok(new List<object>());
                }

                // Aggregate enrollments by workshop via joining cycles -> enrollments
                var popular = await _context.WorkshopCycles
                    .Join(_context.Enrollments, c => c.Id, e => e.WorkshopCycleId, (c, e) => new { c.WorkshopId })
                    .Where(x => x.WorkshopId != 0)
                    .GroupBy(x => x.WorkshopId)
                    .Select(g => new { WorkshopId = g.Key, Count = g.Count() })
                    .OrderByDescending(x => x.Count)
                    .Take(count)
                    .ToListAsync();

                var workshopIds = popular.Select(p => p.WorkshopId).ToList();

                var workshops = await _context.Workshops
                    .Where(w => workshopIds.Contains(w.Id))
                    .Include(w => w.Category)
                    .ToListAsync();

                // preserve ordering by count
                var byId = workshops.ToDictionary(w => w.Id);

                var result = popular.Select(p => {
                    byId.TryGetValue(p.WorkshopId, out var w);
                    return new {
                        id = w?.Id,
                        title = w?.Title,
                        description = w?.Description,
                        price = w?.Price,
                        imageUrl = w?.ImageUrl,
                        thumbnailUrl = w?.ThumbnailUrl,
                        category = w?.Category,
                        averageRating = w?.AverageRating,
                        totalEnrollments = p.Count
                    };
                });

                return Ok(result);
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "WORKSHOPS_POPULAR_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch popular workshops", details = ex.ToString() });
            }
        }

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
            try
            {
                var w = await _context.Workshops.AsNoTracking().FirstOrDefaultAsync(x => x.Id == workshopId);
                if (w == null) return false;
                if (w.DefaultInstructorId == userId.Value) return true;
                try
                {
                    if (await TableExistsAsync("InstructorAssignments"))
                    {
                        return await _context.InstructorAssignments.AnyAsync(a => a.WorkshopId == workshopId && a.InstructorId == userId.Value);
                    }
                }
                catch { }
            }
            catch { }
            return false;
        }
    }
}
