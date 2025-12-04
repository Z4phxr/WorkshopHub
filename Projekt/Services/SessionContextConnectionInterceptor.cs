using System.Data.Common;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Projekt.Data;
using System.Diagnostics;

namespace Projekt.Services
{
    public class SessionContextConnectionInterceptor : DbConnectionInterceptor
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public SessionContextConnectionInterceptor(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
        {
            base.ConnectionOpened(connection, eventData);
            TrySetSessionContext(connection);
        }

        public override System.Threading.Tasks.Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, System.Threading.CancellationToken cancellationToken = default)
        {
            TrySetSessionContext(connection);
            return System.Threading.Tasks.Task.CompletedTask;
        }

        private void TrySetSessionContext(DbConnection connection)
        {
            try
            {
                if (AppDbContext.IsSessionContextSuppressed) return;

                var http = _httpContextAccessor.HttpContext;
                int? userId = null;
                if (http?.User != null)
                {
                    var idStr = http.User.FindFirstValue(ClaimTypes.NameIdentifier);
                    if (int.TryParse(idStr, out var id)) userId = id;
                }
                using var cmd = connection.CreateCommand();
                cmd.CommandText = "EXEC sp_set_session_context @key=N'AppUserId', @value=@uid;";
                var p = cmd.CreateParameter(); p.ParameterName = "@uid"; p.Value = (object?)userId ?? System.DBNull.Value; cmd.Parameters.Add(p);
                cmd.ExecuteNonQuery();
            }
            catch (System.Exception ex)
            {
                Debug.WriteLine($"[SessionContextInterceptor] Failed to set session context: {ex.Message}");
            }
        }
    }
}
