using System.Security.Claims;
using System.Data.Common;
using System.Threading.Tasks;
using System.Diagnostics;

namespace Projekt.Services
{
    public static class SessionContextHelper
    {
        public static async Task SetAppUserIdAsync(DbConnection conn, ClaimsPrincipal? user)
        {
            if (conn == null || user == null || !(user.Identity?.IsAuthenticated ?? false)) return;
            try
            {
                var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                int? userId = int.TryParse(userIdStr, out var id) ? id : null;
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "EXEC sp_set_session_context @key=N'AppUserId', @value=@uid;";
                var p = cmd.CreateParameter(); p.ParameterName = "@uid"; p.Value = (object?)userId ?? System.DBNull.Value; cmd.Parameters.Add(p);
                await cmd.ExecuteNonQueryAsync();
            }
            catch (System.Exception ex)
            {
                Debug.WriteLine($"[SessionContextHelper] Failed to set session context: {ex.Message}");
            }
        }
    }
}
