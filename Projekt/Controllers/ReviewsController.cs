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
    public class ReviewsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;

        public ReviewsController(AppDbContext context, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _audit = audit;
        }

        private async Task RecalculateAverageRatingAsync(int workshopId)
        {
            // left empty since trigger handles recalculating, just keeping call for flow
            await Task.CompletedTask;
        }

        public class ReviewUpdateDto
        {
            public int Id { get; set; }
            public int Rating { get; set; }
            public string? Comment { get; set; }
        }

        // get all reviews, small general list
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<Review>>> GetReviews()
        {
            var reviews = await _context.Reviews
                .Include(r => r.User)
                .Include(r => r.Workshop)
                .ToListAsync();

            return Ok(reviews);
        }

        // get reviews by user with basic paging and sort
        [HttpGet("user/{userId}")]
        [AllowAnonymous]
        public async Task<ActionResult<object>> GetReviewsByUser(
            int userId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string sort = "recent")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;

            var query = _context.Reviews
                .Include(r => r.Workshop)
                .Include(r => r.User)
                .Where(r => r.UserId == userId)
                .AsQueryable();

            sort = (sort ?? "recent").ToLowerInvariant();
            if (sort == "rating")
            {
                query = query.OrderByDescending(r => r.Rating).ThenByDescending(r => r.CreatedAt);
            }
            else
            {
                query = query.OrderByDescending(r => r.CreatedAt);
            }

            var total = await query.CountAsync();
            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            var result = new
            {
                total,
                page,
                pageSize,
                items = items.Select(r => new
                {
                    id = r.Id,
                    rating = r.Rating,
                    comment = r.Comment,
                    createdAt = r.CreatedAt,
                    user = new { id = r.User.Id, firstName = r.User.FirstName, lastName = r.User.LastName },
                    workshop = new { id = r.Workshop.Id, title = r.Workshop.Title }
                })
            };

            return Ok(result);
        }

        // get one review by id, normal fetch
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<Review>> GetReview(int id)
        {
            var review = await _context.Reviews
                .Include(r => r.User)
                .Include(r => r.Workshop)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (review == null)
                return NotFound();

            return Ok(review);
        }

        // create review, simple validation and trim
        [HttpPost]
        [Authorize]
        public async Task<ActionResult<Review>> CreateReview([FromBody] Review review)
        {
            if (review == null)
                return BadRequest("Empty body.");

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (review.Rating < 1 || review.Rating > 5)
                return BadRequest("Rating must be 1-5");

            if (review.Comment != null)
            {
                var trimmed = review.Comment.Trim();
                review.Comment = trimmed.Length == 0 ? null : trimmed;
            }

            if (await _context.Users.FindAsync(review.UserId) == null)
                return BadRequest("User does not exist");

            var workshop = await _context.Workshops.FindAsync(review.WorkshopId);
            if (workshop == null)
                return BadRequest("Workshop does not exist");

            var cycles = await _context.WorkshopCycles.Where(c => c.WorkshopId == review.WorkshopId).Select(c => c.Id).ToListAsync();
            var hasEnrollment = await _context.Enrollments.AnyAsync(e => cycles.Contains(e.WorkshopCycleId) && e.UserId == review.UserId && e.Status == "Active");
            if (!hasEnrollment)
                return BadRequest("User has not attended a cycle of this workshop.");

            _context.Reviews.Add(review);
            await _context.SaveChangesAsync();

            await RecalculateAverageRatingAsync(review.WorkshopId);

            // LOG: Review created
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.REVIEW_CREATED, 
                $"Review ID={review.Id} created by user {review.UserId} for workshop '{workshop.Title}' (ID={review.WorkshopId}): rating={review.Rating}/5");

            return CreatedAtAction(nameof(GetReview), new { id = review.Id }, review);
        }

        // update a review, only admin or author can do it
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateReview(int id, [FromBody] ReviewUpdateDto dto)
        {
            if (dto == null) return BadRequest("Empty body.");
            if (id != dto.Id)
                return BadRequest("Ids do not match.");
            if (dto.Rating < 1 || dto.Rating > 5)
                return BadRequest("Rating must be 1-5");

            var existing = await _context.Reviews
                .Include(r => r.Workshop)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (existing == null)
                return NotFound();

            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId) || !int.TryParse(currentUserId, out var curId))
                return Unauthorized("User not authenticated");
            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && curId != existing.UserId)
                return Forbid();

            var oldRating = existing.Rating;
            existing.Rating = dto.Rating;
            existing.Comment = dto.Comment;
            await _context.SaveChangesAsync();

            await RecalculateAverageRatingAsync(existing.WorkshopId);

            // LOG: Review updated
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.REVIEW_UPDATED, 
                $"Review ID={id} updated for workshop '{existing.Workshop?.Title}' (ID={existing.WorkshopId}): rating {oldRating}/5 → {existing.Rating}/5");

            return NoContent();
        }

        // delete review, again author or admin only
        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteReview(int id)
        {
            var review = await _context.Reviews
                .Include(r => r.Workshop)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (review == null)
                return NotFound();

            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId) || !int.TryParse(currentUserId, out var curId))
                return Unauthorized("User not authenticated");
            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && curId != review.UserId)
                return Forbid();

            var workshopId = review.WorkshopId;
            var workshopTitle = review.Workshop?.Title ?? "Unknown";
            var rating = review.Rating;
            
            // Set SESSION_CONTEXT before delete so triggers have UserId
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            try 
            { 
                await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User); 
            } 
            catch { }
            
            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();

            try { await conn.CloseAsync(); } catch { }
            
            await RecalculateAverageRatingAsync(workshopId);

            // LOG: Review deleted
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.REVIEW_DELETED, 
                $"Review ID={id} deleted from workshop '{workshopTitle}' (ID={workshopId}), was rated {rating}/5");

            return NoContent();
        }
    }
}
