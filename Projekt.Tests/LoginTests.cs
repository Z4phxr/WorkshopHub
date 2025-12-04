using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Projekt.Controllers;
using Projekt.Data;
using Projekt.DTOs;
using Projekt.Models;
using Projekt.Services;
using Xunit;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Mvc;
using System.Threading;
using Microsoft.AspNetCore.Http;

namespace Projekt.Tests
{
    public class LoginTests
    {
        private AppDbContext CreateDb(string name)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(name).Options;
            return new AppDbContext(options);
        }

        [Fact]
        public async Task Login_ReturnsJwtToken_WhenCredentialsValid()
        {
            var db = CreateDb("loginDb");

            // create user with hashed password
            var user = new User { FirstName = "L", LastName = "T", Email = "login.user@example.com", PasswordHash = PasswordHasher.Hash("secret123") };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            // prepare configuration with jwt settings
            var inMemoryConfig = new ConfigurationBuilder().AddInMemoryCollection(new[] {
                new KeyValuePair<string,string?>("Jwt:Key", "test_secret_key_which_is_long_enough"),
                new KeyValuePair<string,string?>("Jwt:Issuer", "test_issuer"),
                new KeyValuePair<string,string?>("Jwt:Audience", "test_audience")
            }).Build();

            var audit = new NullAuditLogger();
            var controller = new AuthController(db, inMemoryConfig, audit);

            var req = new LoginRequest { Email = user.Email, Password = "secret123" };
            var actionResult = await controller.Login(req);
            Assert.NotNull(actionResult);

            // Try to obtain the LoginResponse either from Value or Result
            LoginResponse? loginResponse = null;
            if (actionResult.Value != null)
            {
                loginResponse = actionResult.Value;
            }
            else if (actionResult.Result is OkObjectResult okRes)
            {
                loginResponse = okRes.Value as LoginResponse;
            }

            Assert.NotNull(loginResponse);
            Assert.False(string.IsNullOrWhiteSpace(loginResponse.Token));
        }

        private class NullAuditLogger : IAuditLogger
        {
            public Task LogAsync(int? userId, string action, string details, CancellationToken ct = default) => Task.CompletedTask;
            public Task LogForHttpAsync(HttpContext? httpContext, string action, string details, CancellationToken ct = default) => Task.CompletedTask;
            public Task LogErrorAsync(int? userId, string action, string details, CancellationToken ct = default) => Task.CompletedTask;
        }
    }
}
