using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Projekt.Models
{
    /// <summary>
    /// Represents a workshop category used for organizing, filtering, and listing workshops in the application
    /// </summary>
    public class Category
    {
        public int Id { get; set; }

        [Required]
        public required string Name { get; set; }

        public string? Description { get; set; }

        [JsonIgnore]
        public ICollection<Workshop> Workshops { get; set; } = new List<Workshop>();
    }
}
