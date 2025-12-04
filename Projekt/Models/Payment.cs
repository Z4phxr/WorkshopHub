using System.ComponentModel.DataAnnotations;

namespace Projekt.Models
{
    /// <summary>
    /// Represents a payment made for an enrollment and includes amount, status, optional method and external identifiers, and the relevant timestamps
    /// </summary>
    public class Payment
    {
        public int Id { get; set; }

        [Required]
        public int EnrollmentId { get; set; }
        public Enrollment Enrollment { get; set; } = null!;

        [Required]
        public decimal Amount { get; set; }

        [Required]
        public string Status { get; set; } = "Pending";

        public string? Method { get; set; }
        public string? ExternalPaymentId { get; set; }

        public DateTime? PaidAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
