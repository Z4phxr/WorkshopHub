using System.ComponentModel.DataAnnotations;

namespace Projekt.Models
{
    /// <summary>
    /// Represents a system role entry that defines a role name and description and is used to assign permissions to users
    /// </summary>
    public class Role
    {
        public int Id { get; set; }

        [Required]
        public required string Name { get; set; }

        [Required]
        public required string Description { get; set; }

        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    }

    public class UserRole
    {
        public int UserId { get; set; }
        public User? User { get; set; }
        public int RoleId { get; set; }
        public Role? Role { get; set; }
    }
}
