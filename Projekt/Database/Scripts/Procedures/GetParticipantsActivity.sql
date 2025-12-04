-- this proc pulls activity stats for participants like how many enrollments they had 
-- and how much they paid in a given date range, it is used for admin reports to rank users a bit

IF OBJECT_ID('dbo.GetParticipantsActivity', 'P') IS NOT NULL
    DROP PROCEDURE dbo.GetParticipantsActivity;
GO

CREATE PROCEDURE dbo.GetParticipantsActivity
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @Page INT = 1,
    @PageSize INT = 20,
    @SortBy NVARCHAR(50) = N'totalPaid',
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

    IF OBJECT_ID('tempdb..#Agg') IS NOT NULL DROP TABLE #Agg;
    CREATE TABLE #Agg (
        UserId INT NOT NULL,
        Name NVARCHAR(256) NOT NULL,
        Email NVARCHAR(256) NULL,
        EnrollmentsCount INT NOT NULL,
        TotalPaid DECIMAL(18,2) NOT NULL
    );

    ;WITH PaidPerEnrollment AS (
        SELECT p.EnrollmentId, SUM(p.Amount) AS PaidAmount
        FROM dbo.Payments p
        WHERE LOWER(ISNULL(p.Status,'')) = 'paid'
          AND (
                (p.PaidAt IS NOT NULL AND CONVERT(date, p.PaidAt) BETWEEN @FromDateDate AND @ToDateDate)
             OR (p.PaidAt IS NULL AND CONVERT(date, p.CreatedAt) BETWEEN @FromDateDate AND @ToDateDate)
          )
        GROUP BY p.EnrollmentId
    )
    INSERT INTO #Agg (UserId, Name, Email, EnrollmentsCount, TotalPaid)
    SELECT u.Id AS UserId,
           COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.FirstName,''),' ',ISNULL(u.LastName,'')))), ''), u.Email) AS Name,
           u.Email,
           COUNT(DISTINCT e.Id) AS EnrollmentsCount,
           ISNULL(SUM(ppe.PaidAmount), 0) AS TotalPaid
    FROM dbo.Users u
    LEFT JOIN dbo.Enrollments e ON e.UserId = u.Id
    LEFT JOIN PaidPerEnrollment ppe ON ppe.EnrollmentId = e.Id
    WHERE EXISTS (
        SELECT 1 FROM dbo.UserRoles ur
        JOIN dbo.Roles r ON r.Id = ur.RoleId
        WHERE ur.UserId = u.Id AND LOWER(r.Name) IN ('participants','participant')
    )
    GROUP BY u.Id, u.FirstName, u.LastName, u.Email;

    ;WITH Numbered AS (
        SELECT *, ROW_NUMBER() OVER (
            ORDER BY
                CASE WHEN LOWER(@SortBy) = 'name'        AND LOWER(@SortDir) = 'asc'  THEN Name END ASC,
                CASE WHEN LOWER(@SortBy) = 'name'        AND LOWER(@SortDir) = 'desc' THEN Name END DESC,
                CASE WHEN LOWER(@SortBy) = 'enrollments' AND LOWER(@SortDir) = 'asc'  THEN EnrollmentsCount END ASC,
                CASE WHEN LOWER(@SortBy) = 'enrollments' AND LOWER(@SortDir) = 'desc' THEN EnrollmentsCount END DESC,
                CASE WHEN LOWER(@SortBy) = 'totalpaid'   AND LOWER(@SortDir) = 'asc'  THEN TotalPaid END ASC,
                CASE WHEN LOWER(@SortBy) = 'totalpaid'   AND LOWER(@SortDir) = 'desc' THEN TotalPaid END DESC,
                Name ASC
        ) AS rn
        FROM #Agg
    )
    SELECT 
        UserId AS Id,
        Name,
        Email,
        EnrollmentsCount,
        TotalPaid
    FROM Numbered
    WHERE rn BETWEEN ((@Page - 1) * @PageSize + 1) AND (@Page * @PageSize);

    SELECT COUNT(1) AS Total FROM #Agg;
END
GO
