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
    public class RolesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RolesController(AppDbContext context)
        {
            _context = context;
        }

        // get all roles, just a simple list
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Role>>> GetRoles()
        {
            var roles = await _context.Roles.ToListAsync();
            return Ok(roles);
        }

        // get one role by id, basic fetch
        [HttpGet("{id}")]
        public async Task<ActionResult<Role>> GetRole(int id)
        {
            var role = await _context.Roles.FindAsync(id);
            if (role == null)
                return NotFound();

            return Ok(role);
        }

        // create new role, small check to avoid name duplicates
        [HttpPost]
        public async Task<ActionResult<Role>> CreateRole([FromBody] Role role)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var exists = await _context.Roles.AnyAsync(r => r.Name == role.Name);
            if (exists)
                return BadRequest("role with this name already exists");

            _context.Roles.Add(role);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRole), new { id = role.Id }, role);
        }

        // update existing role, just replaces name and description
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateRole(int id, [FromBody] Role role)
        {
            if (id != role.Id)
                return BadRequest("ids do not match");

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var existing = await _context.Roles.FindAsync(id);
            if (existing == null)
                return NotFound();

            var duplicate = await _context.Roles
                .AnyAsync(r => r.Id != id && r.Name == role.Name);
            if (duplicate)
                return BadRequest("another role with this name already exists");

            existing.Name = role.Name;
            existing.Description = role.Description;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // delete role, but not if someone is still using it
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteRole(int id)
        {
            var role = await _context.Roles.FindAsync(id);
            if (role == null)
                return NotFound();

            var inUse = await _context.UserRoles.AnyAsync(ur => ur.RoleId == id);
            if (inUse)
                return BadRequest("cannot delete role that is assigned to users");

            _context.Roles.Remove(role);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
