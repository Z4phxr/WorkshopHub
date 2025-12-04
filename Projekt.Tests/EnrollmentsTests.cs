using System.Threading.Tasks;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using Xunit;
using System.Linq;

namespace Projekt.Tests
{
    public class EnrollmentsTests
    {
        private static AppDbContext CreateSqliteDb(string dbName)
        {
            var connection = new SqliteConnection("DataSource=:memory:");
            connection.Open();
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(connection)
                .Options;
            var ctx = new AppDbContext(options);
            ctx.Database.EnsureCreated();
            return ctx;
        }

        [Fact]
        public async Task JoinCycle_PreventsDuplicateEnrollment()
        {
            var db = CreateSqliteDb("dupEnrollDb");
            db.Categories.Add(new Category { Name = "Cat" });
            db.Addresses.Add(new Address { City = "X", Street = "Y", BuildingNumber = "1" });
            await db.SaveChangesAsync();

            var categoryId = await db.Categories.Select(c => c.Id).FirstAsync();
            var addressId = await db.Addresses.Select(a => a.Id).FirstAsync();

            var user = new User { FirstName = "T", LastName = "U", Email = "t@example.com", PasswordHash = "h" };
            db.Users.Add(user);
            var w = new Workshop { Title = "W1", IsSeries = false, Price = 0m, MaxParticipants = 10, CategoryId = categoryId, AddressId = addressId };
            db.Workshops.Add(w);
            await db.SaveChangesAsync();

            var cycle = new WorkshopCycle { WorkshopId = w.Id, DisplayName = "C1", StartDate = System.DateTime.UtcNow, IsOpenForEnrollment = true };
            db.WorkshopCycles.Add(cycle);
            await db.SaveChangesAsync();

            db.Enrollments.Add(new Enrollment { UserId = user.Id, WorkshopCycleId = cycle.Id, Status = "Active" });
            await db.SaveChangesAsync();

            db.Enrollments.Add(new Enrollment { UserId = user.Id, WorkshopCycleId = cycle.Id, Status = "Active" });
            await Assert.ThrowsAsync<DbUpdateException>(async () => await db.SaveChangesAsync());
        }
    }
}
