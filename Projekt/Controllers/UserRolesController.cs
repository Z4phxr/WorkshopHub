using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class UserRolesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;

        public UserRolesController(AppDbContext context, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _audit = audit;
        }

        public class AssignRoleDto
        {
            public int UserId { get; set; }
            public int? RoleId { get; set; }
            public string? RoleName { get; set; }
        }

        // post user role adding, simple stuff
        [HttpPost]
        public async Task<ActionResult<UserRole>> AssignRole([FromBody] AssignRoleDto dto)
        {
            if (dto == null || dto.UserId <= 0) return BadRequest("Invalid payload");

            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return BadRequest("User does not exist");

            Role? role = null;
            if (dto.RoleId.HasValue)
            {
                role = await _context.Roles.FindAsync(dto.RoleId.Value);
                if (role == null) return BadRequest("Role does not exist");
            }
            else if (!string.IsNullOrWhiteSpace(dto.RoleName))
            {
                var rn = dto.RoleName.Trim();
                role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == rn);
                if (role == null) return BadRequest("Role does not exist");
            }
            else return BadRequest("RoleId or RoleName is required");

            var exists = await _context.UserRoles.FindAsync(dto.UserId, role.Id);
            if (exists != null) return BadRequest("User already has this role");

            var ur = new UserRole { UserId = dto.UserId, RoleId = role.Id };
            _context.UserRoles.Add(ur);
            await _context.SaveChangesAsync();
            await _audit.LogForHttpAsync(HttpContext, "ROLE_ASSIGNED", $"Role {role.Name} (id {role.Id}) assigned to user {user.Email} (id {user.Id}).");
            return CreatedAtAction(nameof(GetUserRole), new { userId = ur.UserId, roleId = ur.RoleId }, ur);
        }

        // get whole user role list, kinda basic fetch
        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserRole>>> GetUserRoles()
        {
            var userRoles = await _context.UserRoles.Include(ur => ur.User).Include(ur => ur.Role).ToListAsync();
            return Ok(userRoles);
        }

        // get a single user role combo
        [HttpGet("user/{userId}/role/{roleId}")]
        public async Task<ActionResult<UserRole>> GetUserRole(int userId, int roleId)
        {
            var userRole = await _context.UserRoles.Include(ur => ur.User).Include(ur => ur.Role).FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == roleId);
            if (userRole == null) return NotFound();
            return Ok(userRole);
        }

        // remove a role from user with some small rules
        [HttpDelete("user/{userId}/role/{roleId}")]
        public async Task<IActionResult> RemoveRole(int userId, int roleId)
        {
            var userRole = await _context.UserRoles.FindAsync(userId, roleId);
            if (userRole == null) return NotFound();

            var role = await _context.Roles.FindAsync(roleId);
            var roleName = role?.Name;

            // avoid dropping last admin, small sanity check
            if (roleId == 1 || string.Equals(roleName, "Admin", System.StringComparison.OrdinalIgnoreCase))
            {
                var targetRoleId = role?.Id ?? 1;
                var adminCount = await _context.UserRoles.CountAsync(ur => ur.RoleId == targetRoleId);
                if (adminCount <= 1) return BadRequest("Cannot remove Admin role from the last admin user.");
            }

            // stop removing instructor while assignments still in place
            if (roleName != null && string.Equals(roleName, "Instructor", System.StringComparison.OrdinalIgnoreCase))
            {
                var hasDefault = await _context.Workshops.AnyAsync(w => w.DefaultInstructorId == userId);
                var hasCycleOverride = await _context.WorkshopCycles.AnyAsync(c => c.InstructorOverrideId == userId);
                var hasAssignments = await _context.InstructorAssignments.AnyAsync(a => a.InstructorId == userId);
                if (hasDefault || hasCycleOverride || hasAssignments)
                {
                    return Conflict(new { error = "InstructorRoleInUse", detail = "Cannot remove Instructor role while the user is assigned to workshops or cycles, reassign or remove those assignments first" });
                }
            }

            _context.UserRoles.Remove(userRole);
            await _context.SaveChangesAsync();
            var user = await _context.Users.FindAsync(userId);
            if (user != null && role != null) await _audit.LogForHttpAsync(HttpContext, "ROLE_REMOVED", $"Role {role.Name} (id {role.Id}) removed from user {user.Email} (id {user.Id}).");
            return NoContent();
        }
    }
}
