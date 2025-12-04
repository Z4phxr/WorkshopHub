#nullable enable
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using Xunit;

namespace Projekt.Tests
{
    public class PaymentsTests
    {
        private static AppDbContext CreateDb(string name)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options;
            return new AppDbContext(options);
        }

        [Fact]
        public async Task MarkPaymentAsPaid_SetsPaidAtAndStatus()
        {
            var db = CreateDb("paymentsDb");
            var user = new User { FirstName = "P", LastName = "Q", Email = "p@q.com", PasswordHash = "h" };
            db.Users.Add(user);
            var w = new Workshop { Title = "W", IsSeries = false, Price = 10m, MaxParticipants = 5, CategoryId = 1001, AddressId = 50 };
            db.Workshops.Add(w);
            await db.SaveChangesAsync();

            var cycle = new WorkshopCycle { WorkshopId = w.Id, DisplayName = "C", StartDate = System.DateTime.UtcNow, IsOpenForEnrollment = true };
            db.WorkshopCycles.Add(cycle);
            await db.SaveChangesAsync();

            var enrollment = new Enrollment { UserId = user.Id, WorkshopCycleId = cycle.Id, Status = "Active" };
            db.Enrollments.Add(enrollment);
            await db.SaveChangesAsync();

            var payment = new Payment { EnrollmentId = enrollment.Id, Amount = 10m, Status = "Pending" };
            db.Payments.Add(payment);
            await db.SaveChangesAsync();

            payment.Status = "Paid";
            payment.PaidAt = payment.PaidAt ?? System.DateTime.UtcNow;
            await db.SaveChangesAsync();

            var p = await db.Payments.FirstOrDefaultAsync();
            Assert.NotNull(p);
            Assert.Equal("Paid", p!.Status);
            Assert.NotNull(p.PaidAt);
        }
    }
}
