using System.ComponentModel.DataAnnotations;

namespace Projekt.Models
{
    /// <summary>
    /// Represents an application user
    /// </summary>
    public class User
    {
        public int Id { get; set; }

        [Required]
        public required string FirstName { get; set; }

        [Required]
        public required string LastName { get; set; }

        [Required]
        [EmailAddress]
        public required string Email { get; set; }

        [Required]
        public required string PasswordHash { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Multi-role, join table
        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();

        public ICollection<Review> Reviews { get; set; } = new List<Review>();
        public ICollection<Log> Logs { get; set; } = new List<Log>();
        public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    }
}
