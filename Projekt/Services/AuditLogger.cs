using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using Microsoft.Extensions.DependencyInjection;

namespace Projekt.Services
{
    public interface IAuditLogger
    {
        Task LogAsync(int? userId, string action, string details, CancellationToken ct = default);
        Task LogForHttpAsync(HttpContext? httpContext, string action, string details, CancellationToken ct = default);
        Task LogErrorAsync(int? userId, string action, string details, CancellationToken ct = default);
    }

    public class AuditLogger : IAuditLogger
    {
        private readonly ILogger<AuditLogger> _logger;
        private readonly IServiceProvider _provider;

        public AuditLogger(ILogger<AuditLogger> logger, IServiceProvider provider)
        {
            _logger = logger;
            _provider = provider;
        }

        private async Task WriteLogRawAsync(int? userId, string action, string details, CancellationToken ct)
        {
            try
            {
                using var scope = _provider.CreateScope();
                var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                AppDbContext.SuppressSessionContext();
                try
                {
                    if (userId.HasValue)
                    {
                        await ctx.Database.ExecuteSqlRawAsync(
                            "INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt) VALUES ({0}, {1}, {2}, SYSUTCDATETIME())",
                            userId.Value, action, details);
                    }
                    else
                    {
                        await ctx.Database.ExecuteSqlRawAsync(
                            "INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt) VALUES (NULL, {0}, {1}, SYSUTCDATETIME())",
                            action, details);
                    }
                }
                finally
                {
                    AppDbContext.RestoreSessionContext();
                }
            }
            catch (Exception exSql)
            {
                _logger.LogWarning(exSql, "audit db write failed sql");
            }
        }

        public async Task LogAsync(int? userId, string action, string details, CancellationToken ct = default)
        {
            try
            {
                var uid = userId.HasValue ? userId.Value.ToString() : "null";
                _logger.LogInformation("AUDIT {Action} user={UserId} :: {Details}", action, uid, details);
                await WriteLogRawAsync(userId, action, details, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "audit log failed");
            }
        }

        public Task LogForHttpAsync(HttpContext? httpContext, string action, string details, CancellationToken ct = default)
        {
            int? userId = null;
            if (httpContext?.User != null)
            {
                var idStr = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (int.TryParse(idStr, out var id)) userId = id;
            }
            return LogAsync(userId, action, details, ct);
        }

        public async Task LogErrorAsync(int? userId, string action, string details, CancellationToken ct = default)
        {
            try
            {
                var uid = userId.HasValue ? userId.Value.ToString() : "null";
                _logger.LogError("AUDIT ERROR {Action} user={UserId} :: {Details}", action, uid, details);
                await WriteLogRawAsync(userId, action, details, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "audit error log failed");
            }
        }
    }
}
