#nullable enable
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Projekt.Services;

namespace Projekt.Tests.TestHelpers
{
    internal sealed class NullAuditLogger : IAuditLogger
    {
        public Task LogAsync(int? userId, string action, string details, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogForHttpAsync(HttpContext? httpContext, string action, string details, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogErrorAsync(int? userId, string action, string details, CancellationToken ct = default) => Task.CompletedTask;
    }
}
