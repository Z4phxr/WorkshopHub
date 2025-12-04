using System;
using System.ComponentModel.DataAnnotations;

namespace Projekt.Models
{
    /// <summary>
    /// Represents a system log entry that records what action happened, when it happened, and optionally which user performed it for auditing and troubleshooting
    /// </summary>
    public class Log
    {
        public int Id { get; set; }

        // UserId is optional beacuse setNull on delete
        public int? UserId { get; set; }
        public User? User { get; set; }

        [Required]
        public required string Action { get; set; }

        public string? Details { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
