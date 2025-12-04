using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace Projekt.Models

{
    /// <summary>
    /// Represents a user enrollment into a specific workshop cycle and tracks status, timestamps, and related payments for that enrollment
    /// </summary>
    public class Enrollment
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public int WorkshopCycleId { get; set; }
        public WorkshopCycle WorkshopCycle { get; set; } = null!;

        public DateTime EnrolledAt { get; set; } = DateTime.UtcNow;

        [Required]
        public string Status { get; set; } = "Active";

        public DateTime? CancelledAt { get; set; }

        public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    }
}
