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
    public class LogsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LogsController(AppDbContext context)
        {
            _context = context;
        }

        public class LogQuery
        {
            public DateTime? From { get; set; }
            public DateTime? To { get; set; }
            public int? UserId { get; set; }
            public string? Action { get; set; }
            public string? Search { get; set; }
            public int Page { get; set; } = 1;
            public int PageSize { get; set; } = 50;
        }

        // list logs
        [HttpGet]
        public async Task<IActionResult> GetLogs([FromQuery] LogQuery query)
        {
            if (query.Page <= 0) query.Page = 1;
            if (query.PageSize <= 0 || query.PageSize > 500) query.PageSize = 50;

            var q = _context.Logs.Include(l => l.User).AsQueryable();
            if (query.From.HasValue) q = q.Where(l => l.CreatedAt >= query.From.Value);
            if (query.To.HasValue) q = q.Where(l => l.CreatedAt <= query.To.Value);
            if (query.UserId.HasValue) q = q.Where(l => l.UserId == query.UserId);
            if (!string.IsNullOrWhiteSpace(query.Action)) q = q.Where(l => l.Action == query.Action!.Trim());
            if (!string.IsNullOrWhiteSpace(query.Search)) q = q.Where(l => l.Details != null && l.Details.Contains(query.Search!.Trim()));

            var total = await q.CountAsync();
            var items = await q.OrderByDescending(l => l.CreatedAt)
                .Skip((query.Page - 1) * query.PageSize)
                .Take(query.PageSize)
                .Select(l => new
                {
                    l.Id,
                    l.CreatedAt,
                    l.Action,
                    l.Details,
                    user = l.User == null ? null : new { l.User.Id, l.User.Email, l.User.FirstName, l.User.LastName }
                })
                .ToListAsync();

            return Ok(new { total, page = query.Page, pageSize = query.PageSize, items });
        }

        // get one
        [HttpGet("{id}")]
        public async Task<ActionResult<Log>> GetLog(int id)
        {
            var log = await _context.Logs
                .Include(l => l.User)
                .FirstOrDefaultAsync(l => l.Id == id);

            if (log == null)
                return NotFound();

            return Ok(log);
        }

        // delete one
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLog(int id)
        {
            var log = await _context.Logs.FindAsync(id);
            if (log == null)
                return NotFound();

            _context.Logs.Remove(log);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
