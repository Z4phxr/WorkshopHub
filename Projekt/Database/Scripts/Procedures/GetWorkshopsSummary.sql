-- this proc builds a summary of all workshops in a simple paged format, 
-- it calculates stuff like past and future cycles payments rating and how full a workshop is 
-- mostly used by admin reports for sorting and quick overview

IF OBJECT_ID('dbo.GetWorkshopsSummary','P') IS NOT NULL
    DROP PROCEDURE dbo.GetWorkshopsSummary;
GO
CREATE PROCEDURE dbo.GetWorkshopsSummary
    @Page INT = 1,
    @PageSize INT = 20,
    @SortBy NVARCHAR(50) = N'name',
    @SortDir NVARCHAR(4) = N'asc'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page IS NULL OR @Page <= 0 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize <= 0 OR @PageSize > 200 SET @PageSize = 20;

    DECLARE @Offset INT = (@Page - 1) * @PageSize;

    -- temp table for payment sums fetched from sp_GetPaymentsSummaryForWorkshop
    IF OBJECT_ID('tempdb..#PaymentsSummary') IS NOT NULL DROP TABLE #PaymentsSummary;
    CREATE TABLE #PaymentsSummary (
        WorkshopId INT,
        PendingCount INT,
        PendingAmount DECIMAL(18,2),
        PaidCount INT,
        PaidAmount DECIMAL(18,2),
        PaymentsSum DECIMAL(18,2)
    );

    -- fill payment summary
    INSERT INTO #PaymentsSummary
    EXEC dbo.sp_GetPaymentsSummaryForWorkshop @WorkshopId = NULL;

    ;WITH Cycles AS (
        SELECT c.Id, c.WorkshopId, c.IsOpenForEnrollment,
               ISNULL(c.MaxParticipantsOverride, w.MaxParticipants) AS EffectiveCapacity,
               c.StartDate, c.EndDate
        FROM dbo.WorkshopCycles c
        INNER JOIN dbo.Workshops w ON w.Id = c.WorkshopId
    ),
    CyclesAgg AS (
        SELECT c.WorkshopId,
               SUM(CASE WHEN c.EndDate IS NOT NULL AND c.EndDate < SYSUTCDATETIME() THEN 1 ELSE 0 END) AS PastCycles,
               SUM(CASE WHEN c.IsOpenForEnrollment = 1 AND (c.EndDate IS NULL OR c.EndDate >= SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS FutureCycles
        FROM dbo.WorkshopCycles c
        GROUP BY c.WorkshopId
    ),
    EnrollAgg AS (
        SELECT c.WorkshopId,
               SUM(CASE WHEN c.IsOpenForEnrollment = 1 THEN ISNULL(x.ActiveCount,0) ELSE 0 END) AS ActiveEnrollments,
               SUM(CASE WHEN c.IsOpenForEnrollment = 1 THEN c.EffectiveCapacity ELSE 0 END) AS CapacitySum
        FROM Cycles c
        OUTER APPLY (
            SELECT COUNT(*) AS ActiveCount
            FROM dbo.Enrollments e
            WHERE e.WorkshopCycleId = c.Id AND LOWER(ISNULL(e.Status,'')) = 'active'
        ) x
        GROUP BY c.WorkshopId
    )
    SELECT w.Id,
           w.Title AS Name,
           CASE WHEN di.Id IS NOT NULL THEN di.FirstName + ' ' + di.LastName ELSE 'N/A' END AS Instructor,
           -- build address into one line
           CASE WHEN wa.Id IS NOT NULL THEN
                LTRIM(RTRIM(
                    COALESCE(NULLIF(wa.City,''), '') + CASE WHEN COALESCE(wa.City,'') <> '' AND COALESCE(wa.Street,'') <> '' THEN ', ' ELSE '' END
                    + COALESCE(NULLIF(wa.Street,''), '') + CASE WHEN COALESCE(wa.BuildingNumber,'') <> '' THEN ' ' + wa.BuildingNumber ELSE '' END
                    + COALESCE(CASE WHEN wa.Room IS NOT NULL AND wa.Room <> '' THEN ', ' + wa.Room ELSE '' END, '')
                ))
                ELSE NULL END AS Location,
           w.Price,
           ISNULL(ca.PastCycles,0) AS PastCycles,
           ISNULL(ca.FutureCycles,0) AS FutureCycles,
           ISNULL(ps.PaymentsSum,0) AS PaymentsSum,
           ISNULL(w.AverageRating,0) AS AverageRating,
           CAST(CASE WHEN ISNULL(ea.CapacitySum,0) > 0 THEN CAST(ISNULL(ea.ActiveEnrollments,0) AS DECIMAL(18,6)) / CAST(ea.CapacitySum AS DECIMAL(18,6)) ELSE 0 END AS DECIMAL(18,6)) AS FillRatio
    INTO #Summary
    FROM dbo.Workshops w
    LEFT JOIN dbo.Users di ON di.Id = w.DefaultInstructorId
    LEFT JOIN dbo.Addresses wa ON wa.Id = w.AddressId
    LEFT JOIN CyclesAgg ca ON ca.WorkshopId = w.Id
    LEFT JOIN EnrollAgg ea ON ea.WorkshopId = w.Id
    LEFT JOIN #PaymentsSummary ps ON ps.WorkshopId = w.Id;

    DECLARE @Order NVARCHAR(200) =
        CASE LOWER(@SortBy)
            WHEN 'instructor' THEN 'Instructor'
            WHEN 'location' THEN 'Location'
            WHEN 'price' THEN 'Price'
            WHEN 'pastcycles' THEN 'PastCycles'
            WHEN 'futurecycles' THEN 'FutureCycles'
            WHEN 'paymentssum' THEN 'PaymentsSum'
            WHEN 'averagerating' THEN 'AverageRating'
            WHEN 'fillratio' THEN 'FillRatio'
            ELSE 'Name'
        END + ' ' + CASE LOWER(@SortDir) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;

    DECLARE @Sql NVARCHAR(MAX) = N'
        SELECT * FROM #Summary ORDER BY ' + @Order + N'
        OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    EXEC sp_executesql @Sql;

    SELECT COUNT(*) AS Total FROM #Summary;
END
GO
