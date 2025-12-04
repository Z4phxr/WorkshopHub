using System.ComponentModel.DataAnnotations;

namespace Projekt.DTOs
{
    public class RegisterRequest
    {
        [Required]
        [MinLength(2)]
        public required string FirstName { get; set; }

        [Required]
        [MinLength(2)]
        public required string LastName { get; set; }

        [Required]
        [EmailAddress]
        public required string Email { get; set; }

        [Required]
        [MinLength(6)]
        public required string Password { get; set; }
    }
}
