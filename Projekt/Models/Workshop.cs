using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace Projekt.Models
{
    /// <summary>
    /// Represents a workshop template with core information such as title, description, pricing, capacity, and links to cycles and reviews used to present workshops and set defaults
    /// </summary>
    public class Workshop
    {
        public int Id { get; set; }

        [Required]
        public required string Title { get; set; }

        public string? Description { get; set; }

        [Required]
        public bool IsSeries { get; set; }

        [Required]
        public decimal Price { get; set; }

        [Required]
        public int MaxParticipants { get; set; }

        public decimal? AverageRating { get; set; }

        public string? ImageUrl { get; set; }
        public string? ThumbnailUrl { get; set; }

        [Required]
        public int CategoryId { get; set; }
        public Category Category { get; set; } = null!;

        [Required]
        public int AddressId { get; set; }
        public Address Address { get; set; } = null!;

        public int? DefaultInstructorId { get; set; }
        public User? DefaultInstructor { get; set; }

        public ICollection<WorkshopCycle> Cycles { get; set; } = new List<WorkshopCycle>();
        public ICollection<Review> Reviews { get; set; } = new List<Review>();
    }
}
