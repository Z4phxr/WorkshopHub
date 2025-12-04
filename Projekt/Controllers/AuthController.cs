using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Projekt.Data;
using Projekt.DTOs;
using Projekt.Models;
using Projekt.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly Projekt.Services.IAuditLogger _audit;

        public AuthController(AppDbContext context, IConfiguration configuration, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _configuration = configuration;
            _audit = audit;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (request == null)
                return BadRequest(new { message = "Invalid input" });
            if (!ModelState.IsValid)
                return BadRequest(new { message = "Invalid input" });

            try
            {
                var exists = await _context.Users.AnyAsync(u => u.Email == request.Email);
                if (exists)
                    return Conflict(new { message = "Email is already registered" });

                var user = new User
                {
                    FirstName = request.FirstName,
                    LastName = request.LastName,
                    Email = request.Email,
                    PasswordHash = PasswordHasher.Hash(request.Password)
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                var defaultRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "Participant");
                if (defaultRole != null)
                {
                    _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = defaultRole.Id });
                    await _context.SaveChangesAsync();
                    await _audit.LogAsync(user.Id, AuditActions.ROLE_ASSIGNED, $"Role Participant (id {defaultRole.Id}) assigned to user {user.Email} (id {user.Id})");
                }

                try { await _audit.LogAsync(user.Id, Projekt.Services.AuditActions.USER_REGISTERED, $"User {user.Email} (Id={user.Id}) registered"); } catch { }

                return Ok(new { message = "User registered successfully", user = new { user.Id, user.FirstName, user.LastName, user.Email } });
            }
            catch (DbUpdateException)
            {
                return Conflict(new { message = "Email is already registered" });
            }
            catch (Exception ex)
            {
                try { await _audit.LogErrorAsync(null, "AUTH_REGISTER_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { message = "Something went wrong, try again" });
            }
        }

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            if (request == null)
                return BadRequest(new { message = "Invalid input" });
            if (!ModelState.IsValid)
                return BadRequest(new { message = "Invalid input" });

            var user = await _context.Users
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user == null || !PasswordHasher.Verify(user.PasswordHash, request.Password))
                return Unauthorized(new { message = "Invalid email or password" });

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Email)
            };
            var roles = new List<string>();
            foreach (var ur in user.UserRoles)
            {
                if (ur.Role != null)
                {
                    claims.Add(new Claim(ClaimTypes.Role, ur.Role.Name));
                    roles.Add(ur.Role.Name);
                }
            }

            string tokenString;
            try
            {
                var keyStr = _configuration["Jwt:Key"]; var issuer = _configuration["Jwt:Issuer"]; var audience = _configuration["Jwt:Audience"]; var expiresMinutesStr = _configuration["Jwt:ExpiresMinutes"];
                if (string.IsNullOrEmpty(keyStr) || string.IsNullOrEmpty(issuer) || string.IsNullOrEmpty(audience))
                {
                    try { await _audit.LogErrorAsync(user.Id, "AUTH_LOGIN_FAILED", "JWT configuration missing"); } catch { }
                    return StatusCode(500, new { message = "Something went wrong, try again" });
                }
                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyStr));
                var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

                var expiresMinutes = 720;
                if (!string.IsNullOrEmpty(expiresMinutesStr) && int.TryParse(expiresMinutesStr, out var parsed)) expiresMinutes = parsed;

                var token = new JwtSecurityToken(issuer: issuer, audience: audience, claims: claims, expires: DateTime.UtcNow.AddMinutes(expiresMinutes), signingCredentials: creds);
                tokenString = new JwtSecurityTokenHandler().WriteToken(token);
            }
            catch (Exception ex)
            {
                try { await _audit.LogErrorAsync(user.Id, "AUTH_LOGIN_FAILED", ex.ToString()); } catch { }
                return StatusCode(500, new { message = "Something went wrong, try again" });
            }

            try { await _audit.LogAsync(user.Id, Projekt.Services.AuditActions.USER_LOGGED_IN, $"User {user.Email} (Id={user.Id}) logged in"); } catch { }

            return Ok(new LoginResponse { Token = tokenString, Email = user.Email, Roles = roles });
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var email = User.FindFirstValue(ClaimTypes.Name);
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId)) return Unauthorized();

            try { await _audit.LogAsync(userId, AuditActions.USER_LOGGED_OUT, $"User {email} (Id={userId}) logged out"); } catch { }
            return Ok(new { message = "Logged out" });
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> Me()
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var email = User.FindFirstValue(ClaimTypes.Name);
                var roles = User.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).ToList();
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                User? user = null;
                try
                {
                    if (int.TryParse(userId, out var uid))
                    {
                        user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == uid);
                    }
                }
                catch { }

                await Task.CompletedTask;
                return Ok(new { userId = int.Parse(userId), email, roles, firstName = user?.FirstName, lastName = user?.LastName });
            }
            catch
            {
                return Unauthorized();
            }
        }

        [HttpPut("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
        {
            if (req == null) return BadRequest(new { message = "Invalid input" });
            if (!ModelState.IsValid) return BadRequest(new { message = "Invalid input" });

            int? targetUserId = req.UserId;
            var callerIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(callerIdStr) || !int.TryParse(callerIdStr, out var callerId)) return Unauthorized();

            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin)
            {
                if (targetUserId.HasValue && targetUserId.Value != callerId) return Forbid();
                targetUserId = callerId;
            }

            var user = await _context.Users.FindAsync(targetUserId.Value);
            if (user == null) return NotFound();

            if (!isAdmin)
            {
                if (string.IsNullOrEmpty(req.CurrentPassword)) return BadRequest(new { message = "CurrentPassword is required" });
                if (!PasswordHasher.Verify(user.PasswordHash, req.CurrentPassword)) return BadRequest(new { message = "Current password is incorrect" });
            }

            if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
                return BadRequest(new { message = "New password must be at least 6 characters" });

            user.PasswordHash = PasswordHasher.Hash(req.NewPassword);
            await _context.SaveChangesAsync();
            await _audit.LogForHttpAsync(HttpContext, AuditActions.USER_PASSWORD_CHANGED, $"Password changed for user {user.Id} by {(isAdmin ? "Admin" : "User")}{(isAdmin && req.UserId.HasValue ? $" (target {req.UserId.Value})" : string.Empty)}");
            return Ok(new { message = "Password changed successfully" });
        }
    }

    public class ChangePasswordRequest
    {
        public int? UserId { get; set; }
        public string? CurrentPassword { get; set; }
        public string? NewPassword { get; set; }
    }
}
