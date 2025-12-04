#nullable enable
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Projekt.Controllers;
using Projekt.Data;
using Projekt.Models;
using Projekt.Services;
using Xunit;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Mvc;
using Projekt.Tests.TestHelpers;

namespace Projekt.Tests
{
    public class AuthChangePasswordTests
    {
        private static AppDbContext CreateDb(string name)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options;
            return new AppDbContext(options);
        }

        [Fact]
        public async Task NonAdminCanChangeOwnPassword_WithCurrentPassword()
        {
            var db = CreateDb("chg1");
            var user = new User { Id = 1000, FirstName = "U", LastName = "One", Email = "u1@example.com", PasswordHash = PasswordHasher.Hash("oldpwd") };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
            var controller = new AuthController(db, config, new NullAuditLogger());

            var httpContext = new DefaultHttpContext();
            var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()) }, "Test");
            httpContext.User = new ClaimsPrincipal(identity);
            controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

            var req = new ChangePasswordRequest { CurrentPassword = "oldpwd", NewPassword = "newsecret" };
            var res = await controller.ChangePassword(req) as OkObjectResult;
            Assert.NotNull(res);

            var reloaded = await db.Users.FindAsync(user.Id);
            Assert.NotNull(reloaded);
            Assert.True(PasswordHasher.Verify(reloaded!.PasswordHash, "newsecret"));
        }

        [Fact]
        public async Task AdminCanChangeAnotherUsersPassword_WithoutCurrentPassword()
        {
            var db = CreateDb("chg2");
            var target = new User { Id = 2000, FirstName = "T", LastName = "User", Email = "target@example.com", PasswordHash = PasswordHasher.Hash("initial") };
            db.Users.Add(target);
            await db.SaveChangesAsync();

            var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
            var controller = new AuthController(db, config, new NullAuditLogger());

            var httpContext = new DefaultHttpContext();
            var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "999"), new Claim(ClaimTypes.Role, "Admin") }, "Test");
            httpContext.User = new ClaimsPrincipal(identity);
            controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

            var req = new ChangePasswordRequest { UserId = target.Id, NewPassword = "adminset" };
            var res = await controller.ChangePassword(req) as OkObjectResult;
            Assert.NotNull(res);

            var reloaded = await db.Users.FindAsync(target.Id);
            Assert.NotNull(reloaded);
            Assert.True(PasswordHasher.Verify(reloaded!.PasswordHash, "adminset"));
        }
    }
}
