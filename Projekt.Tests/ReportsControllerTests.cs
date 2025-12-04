using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Projekt.Data;
using Projekt.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;
using Projekt.Tests.TestHelpers;

namespace Projekt.Tests
{
    public class ReportsControllerTests
    {
        private static AppDbContext CreateDb(string name)
        {
            var opts = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options;
            return new AppDbContext(opts);
        }

        private static ReportsController CreateController(AppDbContext db)
        {
            var controller = new ReportsController(db, new NullAuditLogger());
            var ctx = new DefaultHttpContext();
            ctx.User = new ClaimsPrincipal(new ClaimsIdentity(new [] { new Claim(ClaimTypes.Role, "Admin") }, "Test"));
            controller.ControllerContext = new ControllerContext { HttpContext = ctx };
            return controller;
        }

        [Fact]
        public async Task WorkshopStatistics_ReturnsZeroes_WhenNoData()
        {
            var db = CreateDb("reports1");
            var controller = CreateController(db);
            db.Workshops.Add(new Projekt.Models.Workshop { Title = "W", MaxParticipants = 10, Price = 50, CategoryId = 1, AddressId = 1 });
            await db.SaveChangesAsync();
            var w = await db.Workshops.FirstAsync();
            var res = await controller.GetWorkshopStatistics(w.Id) as OkObjectResult;
            Assert.NotNull(res);
            var statsJson = System.Text.Json.JsonSerializer.Serialize(res.Value);
            Assert.Contains("WorkshopId", statsJson);
        }

        [Fact]
        public async Task WorkshopStatistics_AggregatesEnrollments_AndPayments()
        {
            var db = CreateDb("reports2");
            var controller = CreateController(db);
            var w = new Projekt.Models.Workshop { Title = "W2", MaxParticipants = 10, Price = 100, CategoryId = 1, AddressId = 1 };
            db.Workshops.Add(w);
            await db.SaveChangesAsync();
            var cycle = new Projekt.Models.WorkshopCycle { WorkshopId = w.Id, DisplayName = "Cycle", StartDate = System.DateTime.UtcNow.AddDays(5), IsOpenForEnrollment = true };
            db.WorkshopCycles.Add(cycle);
            await db.SaveChangesAsync();
            db.Enrollments.AddRange(
                new Projekt.Models.Enrollment { UserId = 1, WorkshopCycleId = cycle.Id, Status = "Active" },
                new Projekt.Models.Enrollment { UserId = 2, WorkshopCycleId = cycle.Id, Status = "Active" }
            );
            await db.SaveChangesAsync();
            var e1 = await db.Enrollments.FirstAsync();
            db.Payments.Add(new Projekt.Models.Payment { EnrollmentId = e1.Id, Amount = 100m, Status = "Paid", Method = "Card", CreatedAt = System.DateTime.UtcNow, PaidAt = System.DateTime.UtcNow });
            await db.SaveChangesAsync();
            var res = await controller.GetWorkshopStatistics(w.Id) as OkObjectResult;
            Assert.NotNull(res);
            var statsJson = System.Text.Json.JsonSerializer.Serialize(res.Value);
            Assert.Contains("TotalEnrollments", statsJson);
        }
    }
}
