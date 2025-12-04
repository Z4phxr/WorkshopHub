#nullable enable
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using Projekt.Controllers;
using Microsoft.Extensions.Configuration;
using Projekt.Services;
using Xunit;
using Microsoft.AspNetCore.Mvc;
using Projekt.Tests.TestHelpers;

namespace Projekt.Tests
{
    public class AuthLoginTests
    {
        private static AppDbContext CreateDb(string name)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options;
            return new AppDbContext(options);
        }

        [Fact]
        public async Task Login_SucceedsWithCorrectCredentials_FailsWithWrong()
        {
            var db = CreateDb("loginDb");
            var user = new User { Id = 500, FirstName = "T", LastName = "User", Email = "t@login.com", PasswordHash = PasswordHasher.Hash("mypwd") };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
            config["Jwt:Key"] = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
            config["Jwt:Issuer"] = "Test";
            config["Jwt:Audience"] = "TestUsers";
            config["Jwt:ExpiresMinutes"] = "60";

            var audit = new NullAuditLogger();
            var controller = new AuthController(db, config, audit);

            var okResult = await controller.Login(new Projekt.DTOs.LoginRequest { Email = user.Email, Password = "mypwd" });
            Assert.IsType<OkObjectResult>(okResult.Result);

            var failResult = await controller.Login(new Projekt.DTOs.LoginRequest { Email = user.Email, Password = "wrong" });
            Assert.IsType<UnauthorizedObjectResult>(failResult.Result);
        }
    }
}
