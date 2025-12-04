using System.ComponentModel.DataAnnotations;

namespace Projekt.Models
{
    /// <summary>
    /// Represents a user review for a workshop
    /// </summary>
    public class Review
    {
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }
        public User? User { get; set; } // navigation optional for model binding

        [Required]
        public int WorkshopId { get; set; }
        public Workshop? Workshop { get; set; } // navigation optional for model binding

        [Required]
        [Range(1, 5)]
        public int Rating { get; set; }

        public string? Comment { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
