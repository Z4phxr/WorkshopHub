using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using Microsoft.Data.SqlClient; // for SqlException mapping
using System.Security.Claims;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;

        public UsersController(AppDbContext context, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _audit = audit;
        }

        public class UserUpdateDto
        {
            public int Id { get; set; }
            public string? FirstName { get; set; }
            public string? LastName { get; set; }
            public string? Email { get; set; }
        }

        // list users (admin)
        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers()
        {
            try
            {
                var list = await _context.Users
                    .Include(u => u.UserRoles)!.ThenInclude(ur => ur.Role)
                    .AsNoTracking()
                    .ToListAsync();

                var users = list.Select(u => new
                {
                    u.Id,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    CreatedAt = u.CreatedAt,
                    Roles = (u.UserRoles ?? new List<UserRole>()).Where(ur => ur.Role != null).Select(ur => ur.Role!.Name).ToList()
                }).ToList();

                return Ok(users);
            }
            catch (Exception ex)
            {
                try { await _audit.LogErrorAsync(null, "USERS_LIST_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch users", detail = ex.Message });
            }
        }

        // list instructors
        [HttpGet("instructors")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<User>>> GetInstructors()
        {
            try
            {
                var instructors = await _context.UserRoles
                    .Include(ur => ur.Role)
                    .Include(ur => ur.User)
                    .Where(ur => ur.Role != null && ur.Role.Name == "Instructor")
                    .Select(ur => ur.User)
                    .Distinct()
                    .AsNoTracking()
                    .ToListAsync();
                return Ok(instructors);
            }
            catch (Exception ex)
            {
                try { await _audit.LogErrorAsync(null, "INSTRUCTORS_LIST_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch instructors", detail = ex.Message });
            }
        }

        // get one (admin)
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            try
            {
                var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
                if (user == null)
                    return NotFound();
                return Ok(user);
            }
            catch (Exception ex)
            {
                try { await _audit.LogErrorAsync(null, "USER_FETCH_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch user", detail = ex.Message });
            }
        }

        // details (admin)
        [HttpGet("{id}/details")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<object>> GetUserDetails(int id)
        {
            try
            {
                var user = await _context.Users
                    .Include(u => u.UserRoles)!.ThenInclude(ur => ur.Role)
                    .Include(u => u.Enrollments)!.ThenInclude(e => e.WorkshopCycle)!.ThenInclude(c => c.Workshop)
                    .Include(u => u.Enrollments)!.ThenInclude(e => e.Payments)
                    .FirstOrDefaultAsync(u => u.Id == id);
                if (user == null) return NotFound();
                var roles = (user.UserRoles ?? new List<UserRole>()).Where(r => r.Role != null).Select(r => r.Role!.Name).ToList();
                var enrollments = (user.Enrollments ?? new List<Enrollment>()).Select(e => new {
                    e.Id,
                    e.WorkshopCycleId,
                    WorkshopTitle = e.WorkshopCycle?.Workshop?.Title,
                    e.EnrolledAt,
                    e.Status,
                    e.CancelledAt,
                    Payments = (e.Payments ?? new List<Payment>()).Select(p => new { p.Id, p.Amount, p.Status, p.Method, p.PaidAt, p.CreatedAt }).ToList()
                }).OrderByDescending(e => e.EnrolledAt).ToList();
                return Ok(new { user.Id, user.FirstName, user.LastName, user.Email, user.CreatedAt, Roles = roles, Enrollments = enrollments });
            }
            catch (Exception ex)
            {
                try { await _audit.LogErrorAsync(null, "USER_DETAILS_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch user details", detail = ex.Message });
            }
        }

        // create user (admin)
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<User>> CreateUser([FromBody] User user)
        {
            if (user == null)
                return BadRequest("Empty body");

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(user.FirstName)) return BadRequest("FirstName is required");
            if (string.IsNullOrWhiteSpace(user.LastName)) return BadRequest("LastName is required");
            if (string.IsNullOrWhiteSpace(user.Email)) return BadRequest("Email is required");
            if (string.IsNullOrWhiteSpace(user.PasswordHash)) return BadRequest("PasswordHash is required");

            try
            {
                var emailExists = await _context.Users.AnyAsync(u => u.Email == user.Email);
                if (emailExists)
                    return Conflict(new { error = "Duplicate email", detail = "User with this email already exists." });
                
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
                
                // LOG: User created
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.USER_CREATED, 
                    $"User '{user.Email}' (ID={user.Id}) created by admin: {user.FirstName} {user.LastName}");
                
                return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to create user: {ex.Message}");
                return StatusCode(500, new { error = "Failed to create user", detail = ex.Message });
            }
        }

        // update user (admin)
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UserUpdateDto userDto)
        {
            if (id != userDto.Id)
                return BadRequest(new { error = "IdMismatch", detail = "Ids do not match" });
            if (!ModelState.IsValid)
                return BadRequest(ModelState);
            try
            {
                var existing = await _context.Users.FindAsync(id);
                if (existing == null)
                    return NotFound();
                
                var oldEmail = existing.Email;
                var oldName = $"{existing.FirstName} {existing.LastName}";
                
                if (!string.IsNullOrWhiteSpace(userDto.Email))
                {
                    var emailExists = await _context.Users.AnyAsync(u => u.Email == userDto.Email && u.Id != id);
                    if (emailExists) return Conflict(new { error = "DuplicateEmail", detail = "Another user with this email already exists." });
                    existing.Email = userDto.Email.Trim();
                }
                existing.FirstName = userDto.FirstName;
                existing.LastName = userDto.LastName;
                
                await _context.SaveChangesAsync();
                
                // LOG: User updated
                var newName = $"{existing.FirstName} {existing.LastName}";
                var changes = new List<string>();
                if (oldName != newName) changes.Add($"name: '{oldName}' → '{newName}'");
                if (oldEmail != existing.Email) changes.Add($"email: '{oldEmail}' → '{existing.Email}'");
                
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.USER_UPDATED, 
                    $"User ID={id} updated by admin: {string.Join(", ", changes)}");
                
                return NoContent();
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to update user ID={id}: {ex.Message}");
                return StatusCode(500, new { error = "Failed to update user", detail = ex.Message });
            }
        }

        // DELETE: self delete (authenticated user deletes own account)
        [HttpDelete("me")]
        [Authorize]
        public async Task<IActionResult> DeleteMe()
        {
            var conn = (System.Data.Common.DbConnection?)null;
            System.Data.Common.DbTransaction? tx = null;
            try
            {
                var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(idStr, out var actorId)) return Unauthorized();

                // Pre-audit
                try { await _audit.LogAsync(null, "USER_DELETE_REQUESTED", $"User {actorId} requested account deletion"); } catch { }

                // Suppress DbContext session context and set NULL at connection level BEFORE any cleanup
                AppDbContext.SuppressSessionContext();
                conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                // start transaction so cleanup + delete share same session
                tx = await conn.BeginTransactionAsync();
                try
                {
                    using var cmdNull = conn.CreateCommand();
                    cmdNull.Transaction = tx;
                    cmdNull.CommandText = "EXEC sp_set_session_context @key=N'AppUserId', @value=@uid;";
                    var pnull = cmdNull.CreateParameter(); pnull.ParameterName = "@uid"; pnull.Value = System.DBNull.Value; cmdNull.Parameters.Add(pnull);
                    await cmdNull.ExecuteNonQueryAsync();
                }
                catch { }

                // Run cleanup using same connection/transaction so triggers see NULL actor
                async Task ExecAsync(string sql, params object[] args)
                {
                    using var cmd = conn.CreateCommand();
                    cmd.Transaction = tx;
                    cmd.CommandText = sql;
                    for (int i = 0; i < args.Length; i++)
                    {
                        var p = cmd.CreateParameter(); p.ParameterName = "@p" + i; p.Value = args[i] ?? System.DBNull.Value; cmd.Parameters.Add(p);
                        cmd.CommandText = cmd.CommandText.Replace("{" + i + "}", "@p" + i);
                    }
                    await cmd.ExecuteNonQueryAsync();
                }

                await ExecAsync("UPDATE dbo.Logs SET UserId = NULL WHERE UserId = {0}", actorId);
                await ExecAsync("DELETE FROM dbo.UserSessions WHERE UserId = {0}", actorId);
                await ExecAsync("UPDATE dbo.WorkshopCycles SET InstructorOverrideId = NULL WHERE InstructorOverrideId = {0}", actorId);

                // Replace EF role queries with raw SQL to avoid transaction conflicts
                bool isAdminActor = false;
                bool isInstructorActor = false;
                // detect roles
                using (var roleCmd = conn.CreateCommand())
                {
                    roleCmd.Transaction = tx;
                    roleCmd.CommandText = @"SELECT r.Name FROM dbo.UserRoles ur INNER JOIN dbo.Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @uid";
                    var p = roleCmd.CreateParameter(); p.ParameterName = "@uid"; p.Value = actorId; roleCmd.Parameters.Add(p);
                    using var reader = await roleCmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var name = reader.GetString(0);
                        if (string.Equals(name, "Admin", StringComparison.OrdinalIgnoreCase)) isAdminActor = true;
                        if (string.Equals(name, "Instructor", StringComparison.OrdinalIgnoreCase)) isInstructorActor = true;
                    }
                }

                if (isInstructorActor)
                {
                    try
                    {
                        await ExecAsync("UPDATE dbo.Workshops SET DefaultInstructorId = NULL WHERE DefaultInstructorId = {0}", actorId);
                        await ExecAsync("DELETE FROM dbo.InstructorAssignments WHERE InstructorId = {0}", actorId);
                    }
                    catch { }
                }
                if (isAdminActor)
                {
                    int adminRoleId = -1;
                    using (var getAdminRoleCmd = conn.CreateCommand())
                    {
                        getAdminRoleCmd.Transaction = tx;
                        getAdminRoleCmd.CommandText = "SELECT TOP 1 Id FROM dbo.Roles WHERE Name = 'Admin'";
                        var obj = await getAdminRoleCmd.ExecuteScalarAsync();
                        if (obj != null && obj != System.DBNull.Value) adminRoleId = Convert.ToInt32(obj);
                    }
                    if (adminRoleId > 0)
                    {
                        int adminCount = 0;
                        using (var countCmd = conn.CreateCommand())
                        {
                            countCmd.Transaction = tx;
                            countCmd.CommandText = "SELECT COUNT(*) FROM dbo.UserRoles WHERE RoleId = @rid";
                            var pr = countCmd.CreateParameter(); pr.ParameterName = "@rid"; pr.Value = adminRoleId; countCmd.Parameters.Add(pr);
                            var obj = await countCmd.ExecuteScalarAsync();
                            adminCount = (obj != null && obj != System.DBNull.Value) ? Convert.ToInt32(obj) : 0;
                        }
                        if (adminCount <= 1)
                        {
                            try { await ExecAsync("DELETE FROM dbo.UserRoles WHERE UserId = {0} AND RoleId = {1}", actorId, adminRoleId); } catch { }
                        }
                    }
                }

                // Delete user using same connection/transaction
                using (var delCmd = conn.CreateCommand())
                {
                    delCmd.Transaction = tx;
                    delCmd.CommandText = "DELETE FROM dbo.Users WHERE Id = @id";
                    var pid = delCmd.CreateParameter(); pid.ParameterName = "@id"; pid.Value = actorId; delCmd.Parameters.Add(pid);
                    var affected = await delCmd.ExecuteNonQueryAsync();
                    if (affected == 0)
                    {
                        await tx.RollbackAsync();
                        AppDbContext.RestoreSessionContext();
                        return NotFound();
                    }
                }

                await tx.CommitAsync();

                try { await conn.CloseAsync(); } catch { }
                AppDbContext.RestoreSessionContext();

                try { await _audit.LogAsync(null, "USER_DELETED", $"Self-deleted user {actorId}"); } catch { }
                try { await _audit.LogAsync(null, "LOGOUT", $"User {actorId} logged out on account delete"); } catch { }

                return NoContent();
            }
            catch (DbUpdateException dbEx)
            {
                try { if (tx != null) await tx.RollbackAsync(); } catch { }
                try { if (conn != null && conn.State == System.Data.ConnectionState.Open) await conn.CloseAsync(); } catch { }
                AppDbContext.RestoreSessionContext();
                try { await _audit.LogErrorAsync(null, "USER_DELETE_CONFLICT", dbEx.ToString()); } catch { }
                return Conflict(new { error = "DeleteConflict", detail = dbEx.Message });
            }
            catch (Exception ex)
            {
                try { if (tx != null) await tx.RollbackAsync(); } catch { }
                try { if (conn != null && conn.State == System.Data.ConnectionState.Open) await conn.CloseAsync(); } catch { }
                AppDbContext.RestoreSessionContext();
                try { await _audit.LogErrorAsync(null, "USER_DELETE_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to delete user", detail = ex.Message });
            }
            finally
            {
                if (conn != null && conn.State == System.Data.ConnectionState.Open)
                {
                    try { await conn.CloseAsync(); } catch { }
                }
            }
        }

        // delete user by id (admin panel)
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var conn = (System.Data.Common.DbConnection?)null;
            try
            {
                // acting user must be admin (controller-wide [Authorize(Roles="Admin")])
                var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "Admin");
                var targetRoles = await _context.UserRoles.Include(ur => ur.Role).Where(ur => ur.UserId == id).Select(ur => ur.Role!.Name).ToListAsync();
                var targetIsAdmin = targetRoles.Any(r => string.Equals(r, "Admin", StringComparison.OrdinalIgnoreCase));
                var targetIsInstructor = targetRoles.Any(r => string.Equals(r, "Instructor", StringComparison.OrdinalIgnoreCase));

                // Admin deleting Participant: always allowed (no extra check)

                // Admin deleting Instructor: only if no assignments
                if (targetIsInstructor)
                {
                    var hasWorkshopsAsDefaultInstructor = await _context.Workshops.AnyAsync(w => w.DefaultInstructorId == id);
                    var hasInstructorAssignments = await _context.InstructorAssignments.AnyAsync(a => a.InstructorId == id);
                    if (hasWorkshopsAsDefaultInstructor || hasInstructorAssignments)
                    {
                        return StatusCode(403, new { error = "Forbidden", detail = "This instructor cannot be deleted because they are assigned to workshops." });
                    }
                }

                // Admin deleting Admin: allowed even if target is last admin
                // (self-deletion is handled in DeleteMe; here acting admin deletes another admin)

                // cleanup logs and sessions
                await _context.Database.ExecuteSqlRawAsync("UPDATE dbo.Logs SET UserId = NULL WHERE UserId = {0}", id);
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM dbo.UserSessions WHERE UserId = {0}", id);
                await _context.Database.ExecuteSqlRawAsync("UPDATE dbo.WorkshopCycles SET InstructorOverrideId = NULL WHERE InstructorOverrideId = {0}", id);

                // set session context actor for trigger audit
                conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                try { await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User); } catch { }

                var user = await _context.Users.FindAsync(id);
                if (user == null) return NotFound();
                _context.Users.Remove(user);
                await _context.SaveChangesAsync();

                // close raw connection before calling audit (audit uses same DbContext)
                if (conn != null && conn.State == System.Data.ConnectionState.Open)
                {
                    try { await conn.CloseAsync(); } catch { }
                }

                try { await _audit.LogErrorAsync(null, "USER_DELETED", $"Admin deleted user {id}"); } catch { }
                return NoContent();
            }
            catch (DbUpdateException dbEx)
            {
                try { if (conn != null && conn.State == System.Data.ConnectionState.Open) await conn.CloseAsync(); } catch { }
                try { await _audit.LogErrorAsync(null, "USER_DELETE_CONFLICT", dbEx.ToString()); } catch { }
                return Conflict(new { error = "DeleteConflict", detail = dbEx.Message });
            }
            catch (Exception ex)
            {
                try { if (conn != null && conn.State == System.Data.ConnectionState.Open) await conn.CloseAsync(); } catch { }
                try { await _audit.LogErrorAsync(null, "USER_DELETE_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to delete user", detail = ex.Message });
            }
            finally
            {
                if (conn != null && conn.State == System.Data.ConnectionState.Open)
                {
                    try { await conn.CloseAsync(); } catch { }
                }
            }
        }
    }
}
