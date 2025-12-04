IF OBJECT_ID('dbo.GetOutstandingPayments', 'P') IS NOT NULL
    DROP PROCEDURE dbo.GetOutstandingPayments;
GO

CREATE PROCEDURE dbo.GetOutstandingPayments
    @OlderThanDays INT = NULL,
    @MinAmount DECIMAL(18,2) = NULL,
    @Page INT = 1,
    @PageSize INT = 20,
    @SortBy NVARCHAR(50) = N'created',
    @SortDir NVARCHAR(4) = N'desc'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page IS NULL OR @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 20;
    IF @PageSize > 200 SET @PageSize = 200;

    IF OBJECT_ID('tempdb..#OutstandingPayments') IS NOT NULL DROP TABLE #OutstandingPayments;
    CREATE TABLE #OutstandingPayments (
        Id INT NOT NULL,
        EnrollmentId INT NOT NULL,
        UserId INT NOT NULL,
        Name NVARCHAR(256) NOT NULL,
        Email NVARCHAR(256) NULL,
        Amount DECIMAL(18,2) NOT NULL,
        CreatedAt DATETIME NOT NULL,
        DaysPending INT NOT NULL
    );

    INSERT INTO #OutstandingPayments (Id, EnrollmentId, UserId, Name, Email, Amount, CreatedAt, DaysPending)
    SELECT 
        p.Id,
        p.EnrollmentId,
        u.Id AS UserId,
        COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.FirstName,''), ' ', ISNULL(u.LastName,'')))), ''), u.Email) AS Name,
        u.Email,
        p.Amount,
        p.CreatedAt,
        DATEDIFF(DAY, p.CreatedAt, GETUTCDATE()) AS DaysPending
    FROM dbo.Payments p
    INNER JOIN dbo.Enrollments e ON e.Id = p.EnrollmentId
    INNER JOIN dbo.Users u ON u.Id = e.UserId
    WHERE LOWER(ISNULL(p.Status, '')) = 'pending'
      AND (@OlderThanDays IS NULL OR DATEDIFF(DAY, p.CreatedAt, GETUTCDATE()) >= @OlderThanDays)
      AND (@MinAmount IS NULL OR p.Amount >= @MinAmount);

    ;WITH Numbered AS (
        SELECT *, ROW_NUMBER() OVER (
            ORDER BY
                CASE WHEN LOWER(@SortBy) = 'name' AND LOWER(@SortDir) = 'asc' THEN Name END ASC,
                CASE WHEN LOWER(@SortBy) = 'name' AND LOWER(@SortDir) = 'desc' THEN Name END DESC,
                CASE WHEN LOWER(@SortBy) = 'amount' AND LOWER(@SortDir) = 'asc' THEN Amount END ASC,
                CASE WHEN LOWER(@SortBy) = 'amount' AND LOWER(@SortDir) = 'desc' THEN Amount END DESC,
                CASE WHEN LOWER(@SortBy) = 'created' AND LOWER(@SortDir) = 'asc' THEN CreatedAt END ASC,
                CASE WHEN LOWER(@SortBy) = 'created' AND LOWER(@SortDir) = 'desc' THEN CreatedAt END DESC,
                CASE WHEN LOWER(@SortBy) = 'createdat' AND LOWER(@SortDir) = 'asc' THEN CreatedAt END ASC,
                CASE WHEN LOWER(@SortBy) = 'createdat' AND LOWER(@SortDir) = 'desc' THEN CreatedAt END DESC,
                CASE WHEN LOWER(@SortBy) = 'dayspending' AND LOWER(@SortDir) = 'asc' THEN DaysPending END ASC,
                CASE WHEN LOWER(@SortBy) = 'dayspending' AND LOWER(@SortDir) = 'desc' THEN DaysPending END DESC,
                CreatedAt DESC
        ) AS rn
        FROM #OutstandingPayments
    )
    SELECT 
        Id,
        EnrollmentId,
        UserId,
        Name,
        Email,
        Amount,
        CreatedAt,
        DaysPending
    FROM Numbered
    WHERE rn BETWEEN ((@Page - 1) * @PageSize + 1) AND (@Page * @PageSize);

    SELECT COUNT(1) AS Total FROM #OutstandingPayments;
END
GO
