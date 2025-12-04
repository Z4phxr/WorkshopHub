using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using System.Security.Claims;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoriesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;

        public CategoriesController(AppDbContext context, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _audit = audit;
        }

        // list categories
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
        {
            var categories = await _context.Categories.ToListAsync();
            return Ok(categories);
        }

        // get one
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<Category>> GetCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
                return NotFound();

            return Ok(category);
        }

        public class CategoryCreateDto
        {
            public required string Name { get; set; }
            public string? Description { get; set; }
        }

        // create category
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Category>> CreateCategory([FromBody] CategoryCreateDto dto)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);
                if (string.IsNullOrWhiteSpace(dto.Name))
                    return BadRequest("Name is required.");

                var exists = await _context.Categories.AnyAsync(c => c.Name == dto.Name);
                if (exists)
                    return Conflict(new { error = "Duplicate", detail = "Category with this name already exists." });

                var category = new Category
                {
                    Name = dto.Name.Trim(),
                    Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim()
                };

                _context.Categories.Add(category);
                await _context.SaveChangesAsync();
                
                // LOG: Category created
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.CATEGORY_CREATED, 
                    $"Category '{category.Name}' (ID={category.Id}) created");
                
                return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, category);
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to create category: {ex.Message}");
                return StatusCode(500, new { error = "Failed to create category", detail = ex.Message });
            }
        }

        public class CategoryUpdateDto
        {
            public int Id { get; set; }
            public required string Name { get; set; }
            public string? Description { get; set; }
        }

        // update category
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateCategory(int id, [FromBody] CategoryUpdateDto dto)
        {
            if (id != dto.Id)
                return BadRequest("Ids do not match");
            if (!ModelState.IsValid)
                return BadRequest(ModelState);
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("Name is required.");

            var existing = await _context.Categories.FindAsync(id);
            if (existing == null)
                return NotFound();

            var oldName = existing.Name;
            existing.Name = dto.Name.Trim();
            existing.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            
            await _context.SaveChangesAsync();
            
            // LOG: Category updated
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.CATEGORY_UPDATED, 
                $"Category ID={id} updated: '{oldName}' → '{existing.Name}'");
            
            return NoContent();
        }

        // delete category
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
                return NotFound();
            
            var categoryName = category.Name;
            
            try
            {
                // Set SESSION_CONTEXT before delete so triggers have UserId
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                try 
                { 
                    await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User); 
                } 
                catch { }
                
                _context.Categories.Remove(category);
                await _context.SaveChangesAsync();
                
                try { await conn.CloseAsync(); } catch { }
                
                // LOG: Category deleted
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.CATEGORY_DELETED, 
                    $"Category '{categoryName}' (ID={id}) deleted");
                
                return NoContent();
            }
            catch (DbUpdateException dbEx)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to delete category ID={id}: {dbEx.Message}");
                return StatusCode(500, new { error = "Failed to delete category", detail = dbEx.Message });
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to delete category ID={id}: {ex.Message}");
                return StatusCode(500, new { error = "Failed to delete category", detail = ex.Message });
            }
        }
    }
}
