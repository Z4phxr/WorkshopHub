IF OBJECT_ID('dbo.GetPaymentsByDateRange','P') IS NOT NULL
    DROP PROCEDURE dbo.GetPaymentsByDateRange;
GO

CREATE PROCEDURE dbo.GetPaymentsByDateRange
    @FromDate   DATETIME = NULL,
    @ToDate     DATETIME = NULL,
    @WorkshopId INT = NULL,
    @Status     NVARCHAR(50) = NULL,
    @Page       INT = 1,
    @PageSize   INT = 20,
    @SortBy     NVARCHAR(50) = N'createdAt',
    @SortDir    NVARCHAR(4) = N'desc'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page IS NULL OR @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 20;
    IF @PageSize > 200 SET @PageSize = 200;

    IF @FromDate IS NULL SET @FromDate = '1900-01-01';
    IF @ToDate IS NULL SET @ToDate = '9999-12-31';

    IF OBJECT_ID('tempdb..#PaymentDetails') IS NOT NULL DROP TABLE #PaymentDetails;
    CREATE TABLE #PaymentDetails (
        PaymentId INT NOT NULL,
        EnrollmentId INT NOT NULL,
        UserId INT NOT NULL,
        UserName NVARCHAR(256) NOT NULL,
        WorkshopId INT NOT NULL,
        WorkshopTitle NVARCHAR(256) NOT NULL,
        Amount DECIMAL(18,2) NOT NULL,
        Status NVARCHAR(50) NOT NULL,
        Method NVARCHAR(100) NULL,
        CreatedAt DATETIME NOT NULL,
        PaidAt DATETIME NULL
    );

    INSERT INTO #PaymentDetails (PaymentId, EnrollmentId, UserId, UserName, WorkshopId, WorkshopTitle, Amount, Status, Method, CreatedAt, PaidAt)
    SELECT
        p.Id AS PaymentId,
        p.EnrollmentId,
        u.Id AS UserId,
        COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.FirstName,''),' ',ISNULL(u.LastName,'')))), ''), u.Email) AS UserName,
        w.Id AS WorkshopId,
        w.Title AS WorkshopTitle,
        p.Amount,
        p.Status,
        p.Method,
        p.CreatedAt,
        p.PaidAt
    FROM dbo.Payments p
    INNER JOIN dbo.Enrollments e ON p.EnrollmentId = e.Id
    INNER JOIN dbo.Users u ON e.UserId = u.Id
    INNER JOIN dbo.WorkshopCycles c ON e.WorkshopCycleId = c.Id
    INNER JOIN dbo.Workshops w ON c.WorkshopId = w.Id
    WHERE p.CreatedAt BETWEEN @FromDate AND @ToDate
      AND (@WorkshopId IS NULL OR w.Id = @WorkshopId)
      AND (@Status IS NULL OR LOWER(p.Status) = LOWER(@Status));

    ;WITH Numbered AS (
        SELECT *,
               ROW_NUMBER() OVER (
                    ORDER BY
                        CASE WHEN LOWER(@SortBy) = 'createdat' AND LOWER(@SortDir) = 'asc'  THEN CreatedAt END ASC,
                        CASE WHEN LOWER(@SortBy) = 'createdat' AND LOWER(@SortDir) = 'desc' THEN CreatedAt END DESC,
                        CASE WHEN LOWER(@SortBy) = 'amount' AND LOWER(@SortDir) = 'asc'  THEN Amount END ASC,
                        CASE WHEN LOWER(@SortBy) = 'amount' AND LOWER(@SortDir) = 'desc' THEN Amount END DESC,
                        CASE WHEN LOWER(@SortBy) = 'status' AND LOWER(@SortDir) = 'asc'  THEN Status END ASC,
                        CASE WHEN LOWER(@SortBy) = 'status' AND LOWER(@SortDir) = 'desc' THEN Status END DESC,
                        CASE WHEN LOWER(@SortBy) = 'username' AND LOWER(@SortDir) = 'asc'  THEN UserName END ASC,
                        CASE WHEN LOWER(@SortBy) = 'username' AND LOWER(@SortDir) = 'desc' THEN UserName END DESC,
                        CASE WHEN LOWER(@SortBy) = 'workshop' AND LOWER(@SortDir) = 'asc'  THEN WorkshopTitle END ASC,
                        CASE WHEN LOWER(@SortBy) = 'workshop' AND LOWER(@SortDir) = 'desc' THEN WorkshopTitle END DESC,
                        CreatedAt DESC
               ) AS rn
        FROM #PaymentDetails
    )
    SELECT 
        PaymentId,
        EnrollmentId,
        UserId,
        UserName,
        WorkshopId,
        WorkshopTitle,
        Amount,
        Status,
        Method,
        CreatedAt,
        PaidAt
    FROM Numbered
    WHERE rn BETWEEN ((@Page - 1) * @PageSize + 1) AND (@Page * @PageSize);

    SELECT COUNT(1) AS Total FROM #PaymentDetails;
END
GO
