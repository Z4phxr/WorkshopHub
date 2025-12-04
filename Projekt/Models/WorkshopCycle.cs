using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Collections.Generic;

namespace Projekt.Models
{
    /// <summary>
    /// Represents a single scheduled run of a workshop template and stores dates, capacity overrides, optional address or instructor overrides, and related sessions and enrollments used for scheduling and sign-ups
    /// </summary>
    public class WorkshopCycle
    {
        public int Id { get; set; }

        [Required]
        public int WorkshopId { get; set; }
        public Workshop Workshop { get; set; } = null!;

        public string? DisplayName { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }

        [Required]
        public bool IsOpenForEnrollment { get; set; } = true;

        // capacity override, when null, use workshop.MaxParticipants
        public int? MaxParticipantsOverride { get; set; }

        // optional address override
        public int? AddressId { get; set; }

        public Address? Address { get; set; }

        // optional instructor override
        public int? InstructorOverrideId { get; set; }
        public User? InstructorOverride { get; set; }


        public ICollection<WorkshopSession> Sessions { get; set; } = new List<WorkshopSession>();
        public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
        public ICollection<InstructorAssignment> Instructors { get; set; } = new List<InstructorAssignment>();
    }
}
