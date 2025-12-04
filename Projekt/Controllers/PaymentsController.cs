using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PaymentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;

        public PaymentsController(AppDbContext context, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _audit = audit;
        }

        // get all payments for admin, simple fetch
        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<Payment>>> GetPayments()
        {
            var list = await _context.Payments
                .Include(p => p.Enrollment).ThenInclude(e => e.WorkshopCycle).ThenInclude(c => c.Workshop)
                .ToListAsync();
            return Ok(list);
        }

        // get single payment by id for admin
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Payment>> GetPayment(int id)
        {
            var payment = await _context.Payments
                .Include(p => p.Enrollment).ThenInclude(e => e.WorkshopCycle).ThenInclude(c => c.Workshop)
                .FirstOrDefaultAsync(p => p.Id == id);
            if (payment == null) return NotFound();
            return Ok(payment);
        }

        // admin can create a payment entry manually if needed
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Payment>> CreatePayment([FromBody] Payment payment)
        {
            if (payment == null)
                return BadRequest("Empty body.");

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // quick validation to avoid very incorrect data
            if (payment.EnrollmentId <= 0)
                return BadRequest("EnrollmentId must be a positive integer.");
            if (payment.Amount < 0)
                return BadRequest("Amount cannot be negative.");
            if (payment.Status != null && string.IsNullOrWhiteSpace(payment.Status))
                return BadRequest("Status cannot be empty if provided.");

            var enrollment = await _context.Enrollments.FindAsync(payment.EnrollmentId);
            if (enrollment == null)
                return BadRequest("Enrollment does not exist.");

            // set basic fields on create
            payment.CreatedAt = DateTime.UtcNow;
            payment.Status ??= "Pending";

            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();

            // audit info about new payment entry
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.PAYMENT_CREATED, $"Payment {payment.Id} created for enrollment {payment.EnrollmentId} with amount {payment.Amount} and status {payment.Status}.");

            return CreatedAtAction(nameof(GetPayment), new { id = payment.Id }, payment);
        }

        // update simple payment fields
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePayment(int id, [FromBody] Payment payment)
        {
            if (id != payment.Id)
                return BadRequest("Ids do not match.");

            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var existing = await _context.Payments.FindAsync(id);
            if (existing == null)
                return NotFound();

            // edit only the direct properties that exist in the model
            existing.Amount = payment.Amount;
            existing.Status = payment.Status;
            existing.Method = payment.Method;
            existing.ExternalPaymentId = payment.ExternalPaymentId;

            await _context.SaveChangesAsync();
            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.PAYMENT_UPDATED, $"Payment {existing.Id} updated. Status={existing.Status}, Amount={existing.Amount}.");
            return NoContent();
        }

        // mark payment as paid, trigger handles timestamps and enrollment state
        [HttpPut("{id}/mark-paid")]
        [Authorize]
        public async Task<IActionResult> MarkPaymentAsPaid(int id)
        {
            var payment = await _context.Payments
                .Include(p => p.Enrollment)
                .FirstOrDefaultAsync(p => p.Id == id);
            if (payment == null) return NotFound();

            var currentUserIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserIdString) || !int.TryParse(currentUserIdString, out int currentUserId))
                return Unauthorized("User not authenticated.");

            var isAdmin = User.IsInRole("Admin");
            if (!isAdmin && payment.Enrollment != null && payment.Enrollment.UserId != currentUserId)
                return Forbid();

            // set paid status, keep method fallback simple
            payment.Status = "Paid";
            payment.Method = string.IsNullOrWhiteSpace(payment.Method) ? "Manual" : payment.Method;
            await _context.SaveChangesAsync();

            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.PAYMENT_MARKED_PAID,
                $"Payment {payment.Id} for enrollment {payment.EnrollmentId} marked as Paid by user {currentUserId}.");

            return Ok(new { message = "Payment marked as paid successfully.", payment = new { payment.Id, payment.Status, payment.PaidAt, payment.Amount } });
        }

        // let user mark a payment for a workshop cycle
        [HttpPut("my-payment/{workshopId}/mark-paid")]
        [Authorize]
        public async Task<IActionResult> MarkMyPaymentAsPaid(int workshopId)
        {
            var currentUserIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserIdString) || !int.TryParse(currentUserIdString, out int currentUserId))
                return Unauthorized("User not authenticated.");

            var cycleIds = await _context.WorkshopCycles.Where(c => c.WorkshopId == workshopId).Select(c => c.Id).ToListAsync();
            var enrollment = await _context.Enrollments
                .Include(e => e.Payments)
                .Include(e => e.WorkshopCycle)
                    .ThenInclude(c => c.Workshop)
                .FirstOrDefaultAsync(e => e.UserId == currentUserId && cycleIds.Contains(e.WorkshopCycleId) && e.Status != null && e.Status.ToUpper() == "ACTIVE");
            if (enrollment == null) return NotFound("You are not enrolled in this workshop.");

            var payment = enrollment.Payments?.FirstOrDefault(p => !string.IsNullOrEmpty(p.Status) && p.Status.ToUpper() == "PENDING");
            if (payment == null) return BadRequest("No pending payment found for this workshop.");

            // mark payment as paid for user
            payment.Status = "Paid";
            payment.Method = string.IsNullOrWhiteSpace(payment.Method) ? "Manual" : payment.Method;
            await _context.SaveChangesAsync();

            await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.PAYMENT_MARKED_PAID,
                $"Payment {payment.Id} for enrollment {payment.EnrollmentId} marked as Paid by user {currentUserId}.");

            return Ok(new { message = "Payment completed successfully!", payment = new { payment.Id, payment.Status, payment.PaidAt, payment.Amount } });
        }

        // user marking payment for given enrollment id
        [HttpPut("my-payment/enrollment/{enrollmentId}/mark-paid")]
        [Authorize]
        public async Task<IActionResult> MarkMyPaymentForEnrollmentAsPaid(int enrollmentId)
        {
            try
            {
                var currentUserIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(currentUserIdString) || !int.TryParse(currentUserIdString, out int currentUserId))
                    return Unauthorized("User not authenticated.");

                var enrollment = await _context.Enrollments
                    .Include(e => e.Payments)
                    .Include(e => e.WorkshopCycle)
                        .ThenInclude(c => c.Workshop)
                    .FirstOrDefaultAsync(e => e.Id == enrollmentId && e.UserId == currentUserId && e.Status != null && e.Status.ToUpper() == "ACTIVE");
                if (enrollment == null) return NotFound("Enrollment not found or does not belong to current user.");

                var payment = enrollment.Payments?.FirstOrDefault(p => !string.IsNullOrEmpty(p.Status) && p.Status.ToUpper() == "PENDING");
                if (payment == null) return BadRequest("No pending payment found for this enrollment.");

                // user marks payment as paid
                payment.Status = "Paid";
                payment.Method = string.IsNullOrWhiteSpace(payment.Method) ? "Manual" : payment.Method;
                await _context.SaveChangesAsync();

                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.PAYMENT_MARKED_PAID,
                    $"Payment {payment.Id} for enrollment {enrollment.Id} marked as Paid by user {currentUserId}.");

                return Ok(new { message = "Payment completed successfully!", payment = new { payment.Id, payment.Status, payment.PaidAt, payment.Amount } });
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "PAYMENT_MARK_PAID_FAILED", ex.ToString()); } catch { }
                // return basic error details for debugging
                return StatusCode(500, new { error = "Failed to mark payment as paid", detail = ex.Message });
            }
        }

        // delete payment by id for admin
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeletePayment(int id)
        {
            var payment = await _context.Payments.FindAsync(id);
            if (payment == null)
                return NotFound();

            _context.Payments.Remove(payment);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // get payments for logged in user only
        [HttpGet("mine")]
        [Authorize]
        public async Task<IActionResult> GetMyPayments()
        {
            var currentUserIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserIdString) || !int.TryParse(currentUserIdString, out int currentUserId))
                return Unauthorized("User not authenticated.");

            var list = await _context.Payments
                .Include(p => p.Enrollment).ThenInclude(e => e.WorkshopCycle).ThenInclude(c => c.Workshop)
                .Where(p => p.Enrollment.UserId == currentUserId)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            var result = list.Select(p => {
                var wc = p.Enrollment.WorkshopCycle; var w = wc.Workshop;
                return new
                {
                    id = p.Id,
                    enrollmentId = p.EnrollmentId,
                    amount = p.Amount,
                    status = p.Status,
                    method = p.Method,
                    externalPaymentId = p.ExternalPaymentId,
                    paidAt = p.PaidAt,
                    createdAt = p.CreatedAt,
                    workshopId = wc.WorkshopId,
                    workshopTitle = w?.Title
                };
            }).ToList();
            return Ok(result);
        }
    }
}
