using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Projekt.Data;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Threading.Tasks;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Instructor")]
    public class ReportsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;
        public ReportsController(AppDbContext context, Projekt.Services.IAuditLogger audit) 
        { 
            _context = context; 
            _audit = audit;
        }

        private class WorkshopStatsDto
        {
            public int WorkshopId { get; set; }
            public int TotalCycles { get; set; }
            public int TotalEnrollments { get; set; }
            public int ActiveEnrollments { get; set; }
            public decimal TotalRevenue { get; set; }
            public decimal AverageRating { get; set; }
        }

        /// <summary>
        /// Workshops summary report with pagination and sorting.
        /// Returns name, instructor, location, price, past/future cycles, payments sum, average rating.
        /// </summary>
        /// <param name="page">Page number (1-based)</param>
        /// <param name="pageSize">Items per page</param>
        /// <param name="sortBy">Column: name|instructor|location|price|pastCycles|futureCycles|paymentsSum|averageRating</param>
        /// <param name="sortDir">asc|desc</param>
        [HttpGet("workshops/summary")]
        public async Task<IActionResult> GetWorkshopsSummary(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string sortBy = "name",
            [FromQuery] string sortDir = "asc")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;
            if (sortBy == null) sortBy = "name"; // ensure non-null for NRT
            if (sortDir == null) sortDir = "asc";

            try
            {
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "dbo.GetWorkshopsSummary";
                cmd.CommandType = CommandType.StoredProcedure;

                var p1 = cmd.CreateParameter(); p1.ParameterName = "@Page"; p1.Value = page; cmd.Parameters.Add(p1);
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@PageSize"; p2.Value = pageSize; cmd.Parameters.Add(p2);
                var p3 = cmd.CreateParameter(); p3.ParameterName = "@SortBy"; p3.Value = sortBy; cmd.Parameters.Add(p3);
                var p4 = cmd.CreateParameter(); p4.ParameterName = "@SortDir"; p4.Value = sortDir; cmd.Parameters.Add(p4);

                var rows = new List<object>();
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        // try to read by name defensively
                        string GetStr(string name)
                        {
                            try { var i = reader.GetOrdinal(name); return reader.IsDBNull(i) ? string.Empty : reader.GetString(i); } catch { return string.Empty; }
                        }
                        int GetInt(string name)
                        {
                            try { var i = reader.GetOrdinal(name); return reader.IsDBNull(i) ? 0 : reader.GetInt32(i); } catch { return 0; }
                        }
                        decimal GetDec(string name)
                        {
                            try { var i = reader.GetOrdinal(name); return reader.IsDBNull(i) ? 0m : reader.GetDecimal(i); } catch { return 0m; }
                        }

                        rows.Add(new
                        {
                            name = GetStr("Name"),
                            instructor = GetStr("Instructor"),
                            location = GetStr("Location"),
                            price = GetDec("Price"),
                            pastCycles = GetInt("PastCycles"),
                            futureCycles = GetInt("FutureCycles"),
                            paymentsSum = GetDec("PaymentsSum"),
                            averageRating = GetDec("AverageRating")
                        });
                    }
                }
                await conn.CloseAsync();

                return Ok(new { page, pageSize, items = rows });
            }
            catch (Exception ex)
            {
                // log the failure to audit
                try 
                {
                    await _audit.LogForHttpAsync(HttpContext, "report_failed", ex.ToString());
                }
                catch {}
                return StatusCode(500, new { title = "An unexpected error occurred.", status = 500, detail = ex.Message, instance = HttpContext.Request.Path });
            }
        }

        [HttpGet("instructors/performance")]
        public async Task<IActionResult> GetInstructorPerformance(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string sortBy = "revenue",
            [FromQuery] string sortDir = "desc")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;
            sortBy ??= "revenue";
            sortDir ??= "desc";
            var localSortBy = sortBy;
            var localSortDir = sortDir;

            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "dbo.GetInstructorPerformance";
            cmd.CommandType = CommandType.StoredProcedure;

            var pFrom = cmd.CreateParameter(); pFrom.ParameterName = "@FromDate"; pFrom.Value = fromDate ?? (object)DBNull.Value; cmd.Parameters.Add(pFrom);
            var pTo = cmd.CreateParameter(); pTo.ParameterName = "@ToDate"; pTo.Value = toDate ?? (object)DBNull.Value; cmd.Parameters.Add(pTo);
            var pPage = cmd.CreateParameter(); pPage.ParameterName = "@Page"; pPage.Value = page; cmd.Parameters.Add(pPage);
            var pPageSize = cmd.CreateParameter(); pPageSize.ParameterName = "@PageSize"; pPageSize.Value = pageSize; cmd.Parameters.Add(pPageSize);
            var pSortBy = cmd.CreateParameter(); pSortBy.ParameterName = "@SortBy"; pSortBy.Value = localSortBy; cmd.Parameters.Add(pSortBy);
            var pSortDir = cmd.CreateParameter(); pSortDir.ParameterName = "@SortDir"; pSortDir.Value = localSortDir; cmd.Parameters.Add(pSortDir);

            T SafeGet<T>(DbDataReader r, string name, Func<int, T> getter, T defaultValue = default)
            {
                try
                {
                    var idx = r.GetOrdinal(name);
                    if (r.IsDBNull(idx)) return defaultValue!;
                    return getter(idx);
                }
                catch (IndexOutOfRangeException)
                {
                    return defaultValue!;
                }
            }

            var items = new List<object>();
            int total = 0;

            await using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    items.Add(new
                    {
                        Id = SafeGet(reader, "Id", i => reader.GetInt32(i), 0),
                        Name = SafeGet(reader, "Name", i => reader.GetString(i), string.Empty),
                        CyclesCount = SafeGet(reader, "CyclesCount", i => reader.GetInt32(i), 0),
                        Revenue = SafeGet(reader, "Revenue", i => reader.GetDecimal(i), 0m),
                        Refunds = SafeGet(reader, "Refunds", i => reader.GetDecimal(i), 0m),
                        AverageRating = SafeGet(reader, "AverageRating", i => reader.GetDecimal(i), 0m)
                    });
                }
                if (await reader.NextResultAsync() && await reader.ReadAsync())
                {
                    total = SafeGet(reader, "Total", i => reader.GetInt32(i), 0);
                }
            }

            await conn.CloseAsync();
            return Ok(new { items, total });
        }

        [HttpGet("students/top-paying")]
        public async Task<IActionResult> GetParticipantsActivity([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string sortBy = "totalPaid", [FromQuery] string sortDir = "desc")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;
            if (sortBy == null) sortBy = "totalPaid";
            if (sortDir == null) sortDir = "desc";

            await using var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "dbo.GetParticipantsActivity";
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.Parameters.Add(new SqlParameter("@FromDate", (object?)fromDate ?? DBNull.Value));
            cmd.Parameters.Add(new SqlParameter("@ToDate", (object?)toDate ?? DBNull.Value));
            cmd.Parameters.Add(new SqlParameter("@Page", page));
            cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
            cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy));
            cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir));

            var items = new List<object>();
            int total = 0;
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                items.Add(new
                {
                    Id = reader.GetInt32(reader.GetOrdinal("Id")),
                    Name = reader.GetString(reader.GetOrdinal("Name")),
                    Email = reader.IsDBNull(reader.GetOrdinal("Email")) ? null : reader.GetString(reader.GetOrdinal("Email")),
                    EnrollmentsCount = reader.GetInt32(reader.GetOrdinal("EnrollmentsCount")),
                    TotalPaid = reader.GetDecimal(reader.GetOrdinal("TotalPaid"))
                });
            }
            if (await reader.NextResultAsync() && await reader.ReadAsync())
            {
                total = reader.GetInt32(reader.GetOrdinal("Total"));
            }
            return Ok(new { items, total });
        }

        [HttpGet("participants/activity")]
        public Task<IActionResult> GetParticipantsActivityAlias([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string sortBy = "totalPaid", [FromQuery] string sortDir = "desc")
            => GetParticipantsActivity(fromDate, toDate, page, pageSize, sortBy, sortDir);

        [HttpGet("payments/outstanding")]
        public async Task<IActionResult> GetOutstandingPayments([FromQuery] int? olderThanDays, [FromQuery] decimal? minAmount, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string sortBy = "created", [FromQuery] string sortDir = "desc")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;
            if (sortBy == null) sortBy = "created";
            if (sortDir == null) sortDir = "desc";

            await using var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "dbo.GetOutstandingPayments";
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.Parameters.Add(new SqlParameter("@OlderThanDays", (object?)olderThanDays ?? DBNull.Value));
            cmd.Parameters.Add(new SqlParameter("@MinAmount", (object?)minAmount ?? DBNull.Value));
            cmd.Parameters.Add(new SqlParameter("@Page", page));
            cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
            cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy));
            cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir));

            var items = new List<object>();
            int total = 0;
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                items.Add(new
                {
                    Id = reader.GetInt32(reader.GetOrdinal("Id")),
                    EnrollmentId = reader.GetInt32(reader.GetOrdinal("EnrollmentId")),
                    UserId = reader.GetInt32(reader.GetOrdinal("UserId")),
                    Name = reader.GetString(reader.GetOrdinal("Name")),
                    Email = reader.IsDBNull(reader.GetOrdinal("Email")) ? null : reader.GetString(reader.GetOrdinal("Email")),
                    Amount = reader.GetDecimal(reader.GetOrdinal("Amount")),
                    CreatedAt = reader.GetDateTime(reader.GetOrdinal("CreatedAt")),
                    DaysPending = reader.GetInt32(reader.GetOrdinal("DaysPending"))
                });
            }
            if (await reader.NextResultAsync() && await reader.ReadAsync())
            {
                total = reader.GetInt32(reader.GetOrdinal("Total"));
            }
            return Ok(new { items, total });
        }

        // NEW: Payment Timeline Report
        [HttpGet("payments/timeline")]
        public async Task<IActionResult> GetPaymentTimeline(
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string sortBy = "createdAt",
            [FromQuery] string sortDir = "desc")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;
            sortBy ??= "createdAt";
            sortDir ??= "desc";

            try
            {
                await using var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "dbo.GetPaymentsByDateRange";
                cmd.CommandType = CommandType.StoredProcedure;
                
                cmd.Parameters.Add(new SqlParameter("@FromDate", (object?)fromDate ?? DBNull.Value));
                cmd.Parameters.Add(new SqlParameter("@ToDate", (object?)toDate ?? DBNull.Value));
                cmd.Parameters.Add(new SqlParameter("@WorkshopId", DBNull.Value));
                cmd.Parameters.Add(new SqlParameter("@Status", DBNull.Value));
                cmd.Parameters.Add(new SqlParameter("@Page", page));
                cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
                cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy));
                cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir));

                var items = new List<object>();
                int total = 0;
                
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    items.Add(new
                    {
                        PaymentId = reader.GetInt32(reader.GetOrdinal("PaymentId")),
                        EnrollmentId = reader.GetInt32(reader.GetOrdinal("EnrollmentId")),
                        UserId = reader.GetInt32(reader.GetOrdinal("UserId")),
                        UserName = reader.GetString(reader.GetOrdinal("UserName")),
                        WorkshopTitle = reader.GetString(reader.GetOrdinal("WorkshopTitle")),
                        Amount = reader.GetDecimal(reader.GetOrdinal("Amount")),
                        Status = reader.GetString(reader.GetOrdinal("Status")),
                        Method = reader.IsDBNull(reader.GetOrdinal("Method")) ? null : reader.GetString(reader.GetOrdinal("Method")),
                        CreatedAt = reader.GetDateTime(reader.GetOrdinal("CreatedAt")),
                        PaidAt = reader.IsDBNull(reader.GetOrdinal("PaidAt")) ? (DateTime?)null : reader.GetDateTime(reader.GetOrdinal("PaidAt"))
                    });
                }
                
                if (await reader.NextResultAsync() && await reader.ReadAsync())
                {
                    total = reader.GetInt32(reader.GetOrdinal("Total"));
                }

                return Ok(new 
                { 
                    items, 
                    total,
                    summary = new 
                    {
                        total,
                        fromDate,
                        toDate
                    }
                });
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "payment_timeline_failed", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch payment timeline", detail = ex.Message });
            }
        }

        // NEW: Workshop Enrollment Roster Report
        [HttpGet("workshops/{workshopId}/enrollments")]
        public async Task<IActionResult> GetWorkshopEnrollmentRoster(
            int workshopId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string sortBy = "enrolledAt",
            [FromQuery] string sortDir = "desc")
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0 || pageSize > 200) pageSize = 20;
            sortBy ??= "enrolledAt";
            sortDir ??= "desc";

            try
            {
                // Verify workshop exists
                var workshop = await _context.Workshops.FindAsync(workshopId);
                if (workshop == null) return NotFound(new { error = "Workshop not found" });

                await using var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "dbo.GetParticipantsForWorkshop";
                cmd.CommandType = CommandType.StoredProcedure;
                
                cmd.Parameters.Add(new SqlParameter("@WorkshopId", workshopId));
                cmd.Parameters.Add(new SqlParameter("@CycleId", DBNull.Value));
                cmd.Parameters.Add(new SqlParameter("@Status", DBNull.Value));
                cmd.Parameters.Add(new SqlParameter("@Page", page));
                cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
                cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy));
                cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir));

                var items = new List<object>();
                int total = 0;
                
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    items.Add(new
                    {
                        EnrollmentId = reader.GetInt32(reader.GetOrdinal("EnrollmentId")),
                        UserId = reader.GetInt32(reader.GetOrdinal("UserId")),
                        UserName = reader.GetString(reader.GetOrdinal("UserName")),
                        Email = reader.IsDBNull(reader.GetOrdinal("Email")) ? null : reader.GetString(reader.GetOrdinal("Email")),
                        CycleId = reader.GetInt32(reader.GetOrdinal("CycleId")),
                        CycleDisplayName = reader.GetString(reader.GetOrdinal("CycleDisplayName")),
                        EnrolledAt = reader.GetDateTime(reader.GetOrdinal("EnrolledAt")),
                        Status = reader.GetString(reader.GetOrdinal("Status")),
                        PaymentStatus = reader.IsDBNull(reader.GetOrdinal("PaymentStatus")) ? null : reader.GetString(reader.GetOrdinal("PaymentStatus"))
                    });
                }
                
                // Second result set contains summary aggregates
                if (await reader.NextResultAsync() && await reader.ReadAsync())
                {
                    total = reader.GetInt32(reader.GetOrdinal("TotalEnrollments"));
                }

                return Ok(new 
                { 
                    items, 
                    total,
                    summary = new 
                    {
                        workshopId,
                        workshopTitle = workshop.Title,
                        totalEnrollments = total
                    }
                });
            }
            catch (Exception ex)
            {
                try { await _audit.LogForHttpAsync(HttpContext, "workshop_enrollments_failed", ex.ToString()); } catch { }
                return StatusCode(500, new { error = "Failed to fetch workshop enrollments", detail = ex.Message });
            }
        }

        [HttpGet("workshops/{workshopId}/stats")]
        public async Task<IActionResult> GetWorkshopStatistics(int workshopId)
        {
            var workshop = await _context.Workshops.FindAsync(workshopId);
            if (workshop == null) return NotFound();

            var cycles = await _context.WorkshopCycles.Where(c => c.WorkshopId == workshopId).ToListAsync();
            var cycleIds = cycles.Select(c => c.Id).ToList();

            int totalEnrollments = 0;
            int activeEnrollments = 0;
            decimal totalRevenue = 0m;
            decimal averageRating = 0m;

            if (cycleIds.Count > 0)
            {
                totalEnrollments = await _context.Enrollments.CountAsync(e => cycleIds.Contains(e.WorkshopCycleId));
                activeEnrollments = await _context.Enrollments.CountAsync(e => cycleIds.Contains(e.WorkshopCycleId) && e.Status != null && e.Status.ToUpper() == "ACTIVE");
                totalRevenue = await _context.Payments
                    .Where(p => p.Status != null && p.Status.ToUpper() == "PAID" && _context.Enrollments.Any(e => e.Id == p.EnrollmentId && cycleIds.Contains(e.WorkshopCycleId)))
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;
                averageRating = await _context.Reviews
                    .Where(r => r.WorkshopId == workshopId)
                    .AverageAsync(r => (decimal?)r.Rating) ?? 0m;
            }

            var dto = new WorkshopStatsDto
            {
                WorkshopId = workshopId,
                TotalCycles = cycles.Count,
                TotalEnrollments = totalEnrollments,
                ActiveEnrollments = activeEnrollments,
                TotalRevenue = totalRevenue,
                AverageRating = averageRating
            };

            return Ok(dto);
        }

        // GET: api/reports/{reportType}/pdf
        [HttpGet("{reportType}/pdf")]
        public async Task<IActionResult> DownloadReportPdf(string reportType, [FromQuery] DateTime? fromDate = null, [FromQuery] DateTime? toDate = null, [FromQuery] int? workshopId = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 200, [FromQuery] string sortBy = "", [FromQuery] string sortDir = "")
        {
            try
            {
                // normalize reportType
                reportType = (reportType ?? string.Empty).ToLowerInvariant();

                // fetch rows depending on type
                List<IDictionary<string, object>> rows = new List<IDictionary<string, object>>();

                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();

                if (reportType == "workshops" || reportType == "workshops-summary" || reportType == "workshops/summary")
                {
                    cmd.CommandText = "dbo.GetWorkshopsSummary";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.Add(new SqlParameter("@Page", page));
                    cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
                    cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy ?? "name"));
                    cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir ?? "asc"));

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var dict = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var name = reader.GetName(i);
                            var val = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                            dict[name] = val ?? string.Empty;
                        }
                        rows.Add(dict);
                    }
                }
                else if (reportType == "instructors" || reportType == "instructors/performance")
                {
                    cmd.CommandText = "dbo.GetInstructorPerformance";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.Add(new SqlParameter("@FromDate", (object?)fromDate ?? DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@ToDate", (object?)toDate ?? DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@Page", page));
                    cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
                    cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy ?? "revenue"));
                    cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir ?? "desc"));

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var dict = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var name = reader.GetName(i);
                            var val = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                            dict[name] = val ?? string.Empty;
                        }
                        rows.Add(dict);
                    }
                }
                else if (reportType == "students" || reportType == "students/top-paying" || reportType == "participants-activity")
                {
                    cmd.CommandText = "dbo.GetParticipantsActivity";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.Add(new SqlParameter("@FromDate", (object?)fromDate ?? DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@ToDate", (object?)toDate ?? DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@Page", page));
                    cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
                    cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy ?? "totalPaid"));
                    cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir ?? "desc"));

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var dict = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var name = reader.GetName(i);
                            var val = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                            dict[name] = val ?? string.Empty;
                        }
                        rows.Add(dict);
                    }
                }
                else if (reportType == "payments" || reportType == "payments/outstanding")
                {
                    cmd.CommandText = "dbo.GetOutstandingPayments";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.Add(new SqlParameter("@OlderThanDays", DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@MinAmount", DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@Page", page));
                    cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
                    cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy ?? "created"));
                    cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir ?? "desc"));

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var dict = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var name = reader.GetName(i);
                            var val = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                            dict[name] = val ?? string.Empty;
                        }
                        rows.Add(dict);
                    }
                }
                else if (reportType == "payments-timeline" || reportType == "payments/timeline")
                {
                    cmd.CommandText = "dbo.GetPaymentsByDateRange";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.Add(new SqlParameter("@FromDate", (object?)fromDate ?? DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@ToDate", (object?)toDate ?? DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@WorkshopId", (object?)workshopId ?? DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@Status", DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@Page", page));
                    cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
                    cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy ?? "createdAt"));
                    cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir ?? "desc"));

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var dict = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var name = reader.GetName(i);
                            var val = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                            dict[name] = val ?? string.Empty;
                        }
                        rows.Add(dict);
                    }
                }
                else if (reportType == "workshop-enrollments" && workshopId.HasValue)
                {
                    cmd.CommandText = "dbo.GetParticipantsForWorkshop";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.Add(new SqlParameter("@WorkshopId", workshopId.Value));
                    cmd.Parameters.Add(new SqlParameter("@CycleId", DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@Status", DBNull.Value));
                    cmd.Parameters.Add(new SqlParameter("@Page", page));
                    cmd.Parameters.Add(new SqlParameter("@PageSize", pageSize));
                    cmd.Parameters.Add(new SqlParameter("@SortBy", sortBy ?? "enrolledAt"));
                    cmd.Parameters.Add(new SqlParameter("@SortDir", sortDir ?? "desc"));

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var dict = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var name = reader.GetName(i);
                            var val = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                            dict[name] = val ?? string.Empty;
                        }
                        rows.Add(dict);
                    }
                }
                else
                {
                    await conn.CloseAsync();
                    return BadRequest(new { error = "UnknownReportType", detail = reportType });
                }

                await conn.CloseAsync();

                // generate PDF using QuestPDF
                var doc = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4.Landscape()); // landscape for wider reports
                        page.Margin(30);
                        page.DefaultTextStyle(x => x.FontSize(10));

                        page.Header().Row(r =>
                        {
                            r.RelativeItem().Text($"Report: {reportType}").FontSize(16).SemiBold();
                            r.ConstantItem(100).AlignRight().Text($"Generated: {DateTime.UtcNow:yyyy-MM-dd}").FontSize(9).FontColor(Colors.Grey.Darken1);
                        });

                        page.Content().PaddingVertical(10).Column(col =>
                        {
                            if (rows.Count == 0)
                            {
                                col.Item().Text("No data");
                            }
                            else
                            {
                                // render simple table: headers from first row keys, values as strings
                                var keys = rows[0].Keys.ToList();
                                col.Item().Table(table =>
                                {
                                    // header
                                    table.ColumnsDefinition(cd => {
                                        foreach (var k in keys) cd.RelativeColumn();
                                    });

                                    table.Header(header =>
                                    {
                                        foreach (var k in keys)
                                            header.Cell().Element(CellStyle).Text(k).SemiBold();
                                    });

                                    foreach (var row in rows)
                                    {
                                        foreach (var k in keys)
                                        {
                                            var txt = row.ContainsKey(k) && row[k] != null ? row[k].ToString() : string.Empty;
                                            table.Cell().Element(CellStyle).Text(txt);
                                        }
                                    }
                                });
                            }

                            static IContainer CellStyle(IContainer c)
                            {
                                return c.Padding(4).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).AlignLeft();
                            }
                        });

                        page.Footer().AlignCenter().Text(x => x.Span("WorkshopHub — generated by system").FontSize(9));
                    });
                });

                using var ms = new MemoryStream();
                doc.GeneratePdf(ms);
                ms.Position = 0;
                return File(ms.ToArray(), "application/pdf", $"report_{reportType}_{DateTime.UtcNow:yyyyMMdd}.pdf");
            }
            catch (Exception ex)
            {
                try 
                {
                    await _audit.LogForHttpAsync(HttpContext, "pdf_generation_failed", ex.ToString());
                }
                catch {}
                return StatusCode(500, new { error = "FailedToGenerateReportPdf", detail = ex.Message });
            }
        }

    }
}
