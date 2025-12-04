#nullable enable
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using Xunit;
using System.Linq;

namespace Projekt.Tests
{
    public class WorkshopsTests
    {
        private static AppDbContext CreateInMemoryDb(string name)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options;
            var ctx = new AppDbContext(options);
            return ctx;
        }

        [Fact]
        public async Task GetInstructors_ReturnsOnlyInstructorRoleUsers()
        {
            var db = CreateInMemoryDb("instrDb");
            var rInstructor = new Role { Id = 1, Name = "Instructor", Description = "Instructor role" };
            var rParticipant = new Role { Id = 2, Name = "Participant", Description = "Participant role" };
            db.Roles.AddRange(rInstructor, rParticipant);
            var u1 = new User { Id = 10, FirstName = "Ins", LastName = "One", Email = "ins1@example.com", PasswordHash = "x" };
            var u2 = new User { Id = 11, FirstName = "P", LastName = "Two", Email = "p2@example.com", PasswordHash = "x" };
            db.Users.AddRange(u1, u2);
            db.SaveChanges();
            db.UserRoles.Add(new UserRole { UserId = u1.Id, RoleId = rInstructor.Id });
            db.UserRoles.Add(new UserRole { UserId = u2.Id, RoleId = rParticipant.Id });
            await db.SaveChangesAsync();

            var instructors = await db.UserRoles
                .Include(ur => ur.Role)
                .Include(ur => ur.User)
                .Where(ur => ur.Role != null && ur.Role.Name == "Instructor")
                .Select(ur => ur.User)
                .Distinct()
                .ToListAsync();

            Assert.Single(instructors);
            Assert.NotNull(instructors.First());
            Assert.Equal(u1.Email, instructors.First().Email);
        }

        [Fact]
        public async Task WorkshopAvailability_ComputesAvailableSeats()
        {
            var db = CreateInMemoryDb("availDb");

            var w = new Workshop { Id = 200, Title = "W", Price = 10, MaxParticipants = 5, CategoryId = 1001, AddressId = 50 };
            db.Workshops.Add(w);
            var c = new WorkshopCycle { Id = 300, WorkshopId = w.Id, IsOpenForEnrollment = true };
            db.WorkshopCycles.Add(c);
            await db.SaveChangesAsync();

            db.Enrollments.AddRange(
                new Enrollment { UserId = 1, WorkshopCycleId = c.Id, Status = "Active" },
                new Enrollment { UserId = 2, WorkshopCycleId = c.Id, Status = "Active" },
                new Enrollment { UserId = 3, WorkshopCycleId = c.Id, Status = "Active" }
            );
            await db.SaveChangesAsync();

            var cycleIds = await db.WorkshopCycles.Where(x => x.WorkshopId == w.Id).Select(x => x.Id).ToListAsync();
            var totalActiveEnrollments = await db.Enrollments.CountAsync(e => cycleIds.Contains(e.WorkshopCycleId) && e.Status != null && e.Status.ToUpper() == "ACTIVE");
            var defaultMax = w.MaxParticipants;
            var totalMax = await db.WorkshopCycles.Where(x => x.WorkshopId == w.Id).SumAsync(x => x.MaxParticipantsOverride ?? defaultMax);
            var availableSeats = totalMax > 0 ? totalMax - totalActiveEnrollments : -1;

            Assert.Equal(2, availableSeats);
        }
    }
}
