using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Projekt.Controllers;
using Projekt.Data;
using Projekt.DTOs;
using Projekt.Models;
using Projekt.Services;
using Xunit;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Projekt.Tests.TestHelpers;

namespace Projekt.Tests
{
    public class AuthControllerTests
    {
        private static AppDbContext CreateDb(string name)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options;
            return new AppDbContext(options);
        }

        [Fact]
        public async Task Register_AssignsParticipantRole_WhenRoleExists()
        {
            var db = CreateDb("authDb");
            db.Roles.Add(new Role { Id = 3, Name = "Participant", Description = "Participant role" });
            await db.SaveChangesAsync();

            var inMemoryConfig = new ConfigurationBuilder().AddInMemoryCollection().Build();
            var audit = new NullAuditLogger();
            var controller = new AuthController(db, inMemoryConfig, audit);

            var req = new RegisterRequest { FirstName = "A", LastName = "B", Email = "a@b.com", Password = "secret" };
            var res = await controller.Register(req) as OkObjectResult;
            Assert.NotNull(res);

            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == "a@b.com");
            Assert.NotNull(user);
            var ur = await db.UserRoles.FirstOrDefaultAsync(x => x.UserId == user.Id && x.RoleId == 3);
            Assert.NotNull(ur);
        }
    }
}
