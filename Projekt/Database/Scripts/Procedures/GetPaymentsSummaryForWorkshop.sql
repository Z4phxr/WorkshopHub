-- this proc builds a simple payment summary per workshop, it checks pending and paid payments and returns counts and sums, 
-- used by the workshops summary report so admin can see basic money stats without heavy joins

IF OBJECT_ID('dbo.sp_GetPaymentsSummaryForWorkshop', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetPaymentsSummaryForWorkshop;
GO

CREATE PROCEDURE dbo.sp_GetPaymentsSummaryForWorkshop
    @WorkshopId INT = NULL  -- null means return all workshops
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        c.WorkshopId,
        SUM(CASE WHEN LOWER(ISNULL(p.Status,'')) = 'pending' THEN 1 ELSE 0 END) AS PendingCount,
        SUM(CASE WHEN LOWER(ISNULL(p.Status,'')) = 'pending' THEN ISNULL(p.Amount, 0) ELSE 0 END) AS PendingAmount,
        SUM(CASE WHEN LOWER(ISNULL(p.Status,'')) = 'paid' THEN 1 ELSE 0 END) AS PaidCount,
        SUM(CASE WHEN LOWER(ISNULL(p.Status,'')) = 'paid' THEN ISNULL(p.Amount, 0) ELSE 0 END) AS PaidAmount,
        SUM(CASE WHEN LOWER(ISNULL(p.Status,'')) = 'paid' THEN ISNULL(p.Amount, 0) ELSE 0 END) AS PaymentsSum
    FROM dbo.WorkshopCycles c
    LEFT JOIN dbo.Enrollments e ON e.WorkshopCycleId = c.Id
    LEFT JOIN dbo.Payments p ON p.EnrollmentId = e.Id
    WHERE (@WorkshopId IS NULL OR c.WorkshopId = @WorkshopId)
    GROUP BY c.WorkshopId
    ORDER BY c.WorkshopId;
END
GO
