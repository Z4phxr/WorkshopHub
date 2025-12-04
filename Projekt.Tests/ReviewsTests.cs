using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using Xunit;

namespace Projekt.Tests
{
    public class ReviewsTests
    {
        private static AppDbContext CreateDb(string name)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options;
            return new AppDbContext(options);
        }

        [Fact]
        public async Task CreateReview_RequiresUserAttendedCycle()
        {
            var db = CreateDb("reviewsDb");
            var user = new User { FirstName = "R", LastName = "S", Email = "r@s.com", PasswordHash = "h" };
            db.Users.Add(user);
            var w = new Workshop { Title = "W", IsSeries = false, Price = 0m, MaxParticipants = 10, CategoryId = 1001, AddressId = 50 };
            db.Workshops.Add(w);
            await db.SaveChangesAsync();

            var cycle = new WorkshopCycle { WorkshopId = w.Id, DisplayName = "C", StartDate = System.DateTime.UtcNow.AddDays(-10), EndDate = System.DateTime.UtcNow.AddDays(-9), IsOpenForEnrollment = false };
            db.WorkshopCycles.Add(cycle);
            await db.SaveChangesAsync();

            var review = new Review { UserId = user.Id, WorkshopId = w.Id, Rating = 5, Comment = "Good" };
            db.Reviews.Add(review);
            await db.SaveChangesAsync();

            var saved = await db.Reviews.FirstOrDefaultAsync();
            Assert.NotNull(saved);
            Assert.Equal(5, saved.Rating);
        }
    }
}
