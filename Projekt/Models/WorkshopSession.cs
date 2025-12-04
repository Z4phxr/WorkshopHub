using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace Projekt.Models
{
    /// <summary>
    /// Represents a single teaching session within a workshop cycle and includes topic, start and end times, and an optional address override for scheduling within the cycle
    /// </summary>
    public class WorkshopSession : IValidatableObject
    {
        public int Id { get; set; }

        [Required]
        public int WorkshopCycleId { get; set; }
        public WorkshopCycle WorkshopCycle { get; set; } = null!;

        public string? Topic { get; set; }

        [Required]
        public DateTime StartTime { get; set; }
        [Required]
        public DateTime EndTime { get; set; }

        public int? AddressId { get; set; }
        [System.ComponentModel.DataAnnotations.Schema.ForeignKey("AddressId")]
        public Address? Address { get; set; }

        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (EndTime <= StartTime)
            {
                yield return new ValidationResult("EndTime must be after StartTime.", new[] { nameof(EndTime), nameof(StartTime) });
            }
        }
    }
}
