using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Projekt.Models
{
    /// <summary>
    /// Represents a physical location where workshops are held
    /// </summary>
    public class Address
    {
        public int Id { get; set; }

        [Required]
        public required string City { get; set; }

        [Required]
        public required string Street { get; set; }

        [Required]
        public required string BuildingNumber { get; set; }

        public string? Room { get; set; }

        public string? AdditionalInfo { get; set; }

        [JsonIgnore]
        public ICollection<Workshop> Workshops { get; set; } = new List<Workshop>();
    }
}
