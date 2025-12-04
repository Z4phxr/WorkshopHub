-- this proc gets upcoming enrollments for a user, it checks cycles and sessions to see what is still ahead,
-- used when the app shows the user their future workshops with dates

IF NOT EXISTS (
    SELECT 1 
    FROM sys.objects 
    WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetUpcomingEnrollmentsForUser]') 
      AND type IN (N'P','PC')
)
    EXEC ('CREATE PROCEDURE [dbo].[sp_GetUpcomingEnrollmentsForUser] AS BEGIN SET NOCOUNT ON; END');
GO

ALTER PROCEDURE [dbo].[sp_GetUpcomingEnrollmentsForUser]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH Upcoming AS (
        SELECT e.Id AS EnrollmentId,
               w.Title AS WorkshopTitle,
               c.StartDate AS CycleStartDate,
               c.EndDate AS CycleEndDate,
               c.DisplayName AS CycleDisplayName,
               MIN(s.StartTime) AS SessionStartTime
        FROM Enrollments e
        INNER JOIN WorkshopCycles c ON e.WorkshopCycleId = c.Id
        INNER JOIN Workshops w ON c.WorkshopId = w.Id
        LEFT JOIN WorkshopSessions s ON s.WorkshopCycleId = c.Id
        WHERE e.UserId = @UserId
          AND (e.Status IS NOT NULL AND UPPER(e.Status) = 'ACTIVE')
          AND (
                (c.StartDate >= SYSUTCDATETIME())
                OR EXISTS (
                    SELECT 1 
                    FROM WorkshopSessions s2
                    WHERE s2.WorkshopCycleId = c.Id 
                      AND s2.StartTime >= SYSUTCDATETIME()
                )
              )
        GROUP BY e.Id, w.Title, c.StartDate, c.EndDate, c.DisplayName
    )
    SELECT EnrollmentId,
           WorkshopTitle,
           CycleStartDate,
           CycleEndDate,
           CycleDisplayName,
           SessionStartTime
    FROM Upcoming
    ORDER BY COALESCE(SessionStartTime, CycleStartDate);
END
GO
