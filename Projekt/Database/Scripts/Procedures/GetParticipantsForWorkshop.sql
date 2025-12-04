-- this proc builds a list of people signed up for a workshop with their cycle info and payment status
-- helps admins see who joined how far along the cycle is and who already paid
-- used by admin views and reports that need a full roster

IF OBJECT_ID('dbo.GetParticipantsForWorkshop', 'P') IS NOT NULL
    DROP PROCEDURE dbo.GetParticipantsForWorkshop;
GO
CREATE PROCEDURE dbo.GetParticipantsForWorkshop
    @WorkshopId INT,
    @CycleId    INT = NULL,
    @Status     NVARCHAR(50) = NULL,
    @Page       INT = 1,
    @PageSize   INT = 20,
    @SortBy     NVARCHAR(50) = N'enrolledAt',
    @SortDir    NVARCHAR(4) = N'desc'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Page IS NULL OR @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 20;
    IF @PageSize > 200 SET @PageSize = 200;

    IF OBJECT_ID('tempdb..#EnrollmentRoster') IS NOT NULL DROP TABLE #EnrollmentRoster;
    CREATE TABLE #EnrollmentRoster (
        EnrollmentId INT NOT NULL,
        UserId INT NOT NULL,
        UserName NVARCHAR(256) NOT NULL,
        Email NVARCHAR(256) NULL,
        CycleId INT NOT NULL,
        CycleDisplayName NVARCHAR(256) NULL,
        CycleStartDate DATETIME NOT NULL,
        EnrolledAt DATETIME NOT NULL,
        Status NVARCHAR(50) NOT NULL,
        PaymentStatus NVARCHAR(50) NULL,
        PaymentAmount DECIMAL(18,2) NULL,
        PaidAt DATETIME NULL
    );

    INSERT INTO #EnrollmentRoster (EnrollmentId, UserId, UserName, Email, CycleId, CycleDisplayName, CycleStartDate, EnrolledAt, Status, PaymentStatus, PaymentAmount, PaidAt)
    SELECT
        e.Id AS EnrollmentId,
        u.Id AS UserId,
        COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.FirstName,''),' ',ISNULL(u.LastName,'')))), ''), u.Email) AS UserName,
        u.Email,
        c.Id AS CycleId,
        c.DisplayName AS CycleDisplayName,
        c.StartDate AS CycleStartDate,
        e.EnrolledAt,
        e.Status,
        p.Status AS PaymentStatus,
        p.Amount AS PaymentAmount,
        p.PaidAt
    FROM dbo.Enrollments e
    INNER JOIN dbo.Users u ON u.Id = e.UserId
    INNER JOIN dbo.WorkshopCycles c ON c.Id = e.WorkshopCycleId
    INNER JOIN dbo.Workshops w ON w.Id = c.WorkshopId
    LEFT JOIN dbo.Payments p ON p.EnrollmentId = e.Id
    WHERE w.Id = @WorkshopId
      AND (@CycleId IS NULL OR c.Id = @CycleId)
      AND (@Status IS NULL OR LOWER(e.Status) = LOWER(@Status));

    ;WITH Numbered AS (
        SELECT *, ROW_NUMBER() OVER (
            ORDER BY
                CASE WHEN LOWER(@SortBy) = 'enrolledat' AND LOWER(@SortDir) = 'asc'  THEN EnrolledAt END ASC,
                CASE WHEN LOWER(@SortBy) = 'enrolledat' AND LOWER(@SortDir) = 'desc' THEN EnrolledAt END DESC,
                CASE WHEN LOWER(@SortBy) = 'username' AND LOWER(@SortDir) = 'asc'  THEN UserName END ASC,
                CASE WHEN LOWER(@SortBy) = 'username' AND LOWER(@SortDir) = 'desc' THEN UserName END DESC,
                CASE WHEN LOWER(@SortBy) = 'cycledate' AND LOWER(@SortDir) = 'asc'  THEN CycleStartDate END ASC,
                CASE WHEN LOWER(@SortBy) = 'cycledate' AND LOWER(@SortDir) = 'desc' THEN CycleStartDate END DESC,
                CASE WHEN LOWER(@SortBy) = 'paymentstatus' AND LOWER(@SortDir) = 'asc'  THEN PaymentStatus END ASC,
                CASE WHEN LOWER(@SortBy) = 'paymentstatus' AND LOWER(@SortDir) = 'desc' THEN PaymentStatus END DESC,
                EnrolledAt DESC
        ) AS rn
        FROM #EnrollmentRoster
    )
    SELECT 
        EnrollmentId,
        UserId,
        UserName,
        Email,
        CycleId,
        CycleDisplayName,
        CycleStartDate,
        EnrolledAt,
        Status,
        PaymentStatus,
        PaymentAmount,
        PaidAt
    FROM Numbered
    WHERE rn BETWEEN ((@Page - 1) * @PageSize + 1) AND (@Page * @PageSize);

    -- Summary aggregates
    SELECT 
        COUNT(DISTINCT EnrollmentId) AS TotalEnrollments,
        COUNT(DISTINCT UserId) AS UniqueParticipants,
        SUM(CASE WHEN LOWER(Status) = 'active' THEN 1 ELSE 0 END) AS ActiveCount,
        SUM(CASE WHEN LOWER(Status) = 'cancelled' THEN 1 ELSE 0 END) AS CancelledCount,
        SUM(CASE WHEN LOWER(PaymentStatus) = 'paid' THEN PaymentAmount ELSE 0 END) AS TotalRevenue,
        SUM(CASE WHEN LOWER(PaymentStatus) = 'pending' THEN PaymentAmount ELSE 0 END) AS PendingRevenue
    FROM #EnrollmentRoster;
END
GO
