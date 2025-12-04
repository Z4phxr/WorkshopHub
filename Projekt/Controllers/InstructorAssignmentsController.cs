using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Instructor")]
    public class InstructorAssignmentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public InstructorAssignmentsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _context.InstructorAssignments.ToListAsync());

        [HttpGet("by-workshop/{workshopId}")]
        public async Task<IActionResult> GetByWorkshop(int workshopId)
        {
            var list = await _context.InstructorAssignments.Where(a => a.WorkshopId == workshopId).ToListAsync();
            return Ok(list);
        }

        [HttpGet("by-cycle/{cycleId}")]
        public async Task<IActionResult> GetByCycle(int cycleId)
        {
            var list = await _context.InstructorAssignments.Where(a => a.WorkshopCycleId == cycleId).ToListAsync();
            return Ok(list);
        }

        [HttpGet("by-session/{sessionId}")]
        public async Task<IActionResult> GetBySession(int sessionId)
        {
            var list = await _context.InstructorAssignments.Where(a => a.WorkshopSessionId == sessionId).ToListAsync();
            return Ok(list);
        }

        public record AssignmentDto(int? WorkshopId, int? WorkshopCycleId, int? WorkshopSessionId, int InstructorId, bool IsLead = false);

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] AssignmentDto dto)
        {
            if (dto.WorkshopId == null && dto.WorkshopCycleId == null && dto.WorkshopSessionId == null)
                return BadRequest("At least one scope id must be provided");

            var user = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == dto.InstructorId);
            if (user == null) return BadRequest("Instructor not found");
            var isInstructor = (user.UserRoles ?? new List<UserRole>()).Any(ur => ur.Role != null && ur.Role.Name == "Instructor");
            if (!isInstructor) return BadRequest("User is not an Instructor");

            var assignment = new InstructorAssignment
            {
                WorkshopId = dto.WorkshopId,
                WorkshopCycleId = dto.WorkshopCycleId,
                WorkshopSessionId = dto.WorkshopSessionId,
                InstructorId = dto.InstructorId,
                IsLead = dto.IsLead
            };
            _context.Add(assignment);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAll), new { id = assignment.Id }, assignment);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var a = await _context.InstructorAssignments.FindAsync(id);
            if (a == null) return NotFound();
            _context.InstructorAssignments.Remove(a);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
