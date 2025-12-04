using System.ComponentModel.DataAnnotations;

namespace Projekt.Models
{
    /// <summary>
    /// Represents an instructor assignment that can be linked to a workshop, a workshop cycle, or a session to indicate where the instructor is responsible
    /// </summary>
    public class InstructorAssignment
    {
        public int Id { get; set; }

        public int? WorkshopId { get; set; }
        public int? WorkshopCycleId { get; set; }
        public int? WorkshopSessionId { get; set; }

        [Required]
        public int InstructorId { get; set; }
        public User Instructor { get; set; } = null!;

        public bool IsLead { get; set; }
    }
}
