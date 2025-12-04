-- this proc builds a small activity summary for instructors
-- it checks how many cycles they taught, how much revenue they generated, and what their average rating is

IF OBJECT_ID('dbo.GetInstructorPerformance', 'P') IS NOT NULL
    DROP PROCEDURE dbo.GetInstructorPerformance;
GO

CREATE PROCEDURE dbo.GetInstructorPerformance
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @Page INT = 1,
    @PageSize INT = 20,
    @SortBy NVARCHAR(50) = N'revenue',
    @SortDir NVARCHAR(4) = N'desc'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page IS NULL OR @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 20;
    IF @PageSize > 200 SET @PageSize = 200;

    IF @FromDate IS NULL SET @FromDate = '1900-01-01';
    IF @ToDate IS NULL SET @ToDate = '9999-12-31';

    DECLARE @FromDateDate DATE = CONVERT(date, @FromDate);
    DECLARE @ToDateDate DATE = CONVERT(date, @ToDate);

    IF OBJECT_ID('tempdb..#InstructorStats') IS NOT NULL DROP TABLE #InstructorStats;
    CREATE TABLE #InstructorStats (
        InstructorId INT NOT NULL,
        Name NVARCHAR(256) NOT NULL,
        CyclesCount INT NOT NULL,
        Revenue DECIMAL(18,2) NOT NULL,
        Refunds DECIMAL(18,2) NOT NULL,
        AverageRating DECIMAL(5,2) NOT NULL
    );

    INSERT INTO #InstructorStats (InstructorId, Name, CyclesCount, Revenue, Refunds, AverageRating)
    SELECT 
        u.Id AS InstructorId,
        COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.FirstName,''), ' ', ISNULL(u.LastName,'')))), ''), u.Email) AS Name,
        COUNT(DISTINCT CASE 
            WHEN c.Id IS NOT NULL AND CONVERT(date, c.StartDate) BETWEEN @FromDateDate AND @ToDateDate 
            THEN c.Id 
            ELSE NULL 
        END) AS CyclesCount,
        ISNULL(SUM(CASE 
            WHEN p.Status = 'Paid' AND c.Id IS NOT NULL AND CONVERT(date, c.StartDate) BETWEEN @FromDateDate AND @ToDateDate 
            THEN p.Amount 
            ELSE 0 
        END), 0) AS Revenue,
        0 AS Refunds,
        ISNULL(AVG(CASE 
            WHEN r.Rating IS NOT NULL AND c.Id IS NOT NULL AND CONVERT(date, c.StartDate) BETWEEN @FromDateDate AND @ToDateDate 
            THEN CAST(r.Rating AS DECIMAL(5,2)) 
            ELSE NULL 
        END), 0) AS AverageRating
    FROM dbo.Users u
    INNER JOIN dbo.UserRoles ur ON ur.UserId = u.Id
    INNER JOIN dbo.Roles rol ON rol.Id = ur.RoleId AND LOWER(rol.Name) = 'instructor'
    LEFT JOIN dbo.Workshops w ON w.DefaultInstructorId = u.Id
    LEFT JOIN dbo.WorkshopCycles c ON c.WorkshopId = w.Id
    LEFT JOIN dbo.Enrollments e ON e.WorkshopCycleId = c.Id
    LEFT JOIN dbo.Payments p ON p.EnrollmentId = e.Id
    LEFT JOIN dbo.Reviews r ON r.WorkshopId = w.Id
    GROUP BY u.Id, u.FirstName, u.LastName, u.Email;

    ;WITH Numbered AS (
        SELECT *, ROW_NUMBER() OVER (
            ORDER BY
                CASE WHEN LOWER(@SortBy) = 'name' AND LOWER(@SortDir) = 'asc' THEN Name END ASC,
                CASE WHEN LOWER(@SortBy) = 'name' AND LOWER(@SortDir) = 'desc' THEN Name END DESC,
                CASE WHEN LOWER(@SortBy) = 'cycles' AND LOWER(@SortDir) = 'asc' THEN CyclesCount END ASC,
                CASE WHEN LOWER(@SortBy) = 'cycles' AND LOWER(@SortDir) = 'desc' THEN CyclesCount END DESC,
                CASE WHEN LOWER(@SortBy) = 'cyclescount' AND LOWER(@SortDir) = 'asc' THEN CyclesCount END ASC,
                CASE WHEN LOWER(@SortBy) = 'cyclescount' AND LOWER(@SortDir) = 'desc' THEN CyclesCount END DESC,
                CASE WHEN LOWER(@SortBy) = 'revenue' AND LOWER(@SortDir) = 'asc' THEN Revenue END ASC,
                CASE WHEN LOWER(@SortBy) = 'revenue' AND LOWER(@SortDir) = 'desc' THEN Revenue END DESC,
                CASE WHEN LOWER(@SortBy) = 'rating' AND LOWER(@SortDir) = 'asc' THEN AverageRating END ASC,
                CASE WHEN LOWER(@SortBy) = 'rating' AND LOWER(@SortDir) = 'desc' THEN AverageRating END DESC,
                CASE WHEN LOWER(@SortBy) = 'averagerating' AND LOWER(@SortDir) = 'asc' THEN AverageRating END ASC,
                CASE WHEN LOWER(@SortBy) = 'averagerating' AND LOWER(@SortDir) = 'desc' THEN AverageRating END DESC,
                Name ASC
        ) AS rn
        FROM #InstructorStats
    )
    SELECT 
        InstructorId AS Id,
        Name,
        CyclesCount,
        Revenue,
        Refunds,
        AverageRating
    FROM Numbered
    WHERE rn BETWEEN ((@Page - 1) * @PageSize + 1) AND (@Page * @PageSize);

    SELECT COUNT(1) AS Total FROM #InstructorStats;
END
GO
