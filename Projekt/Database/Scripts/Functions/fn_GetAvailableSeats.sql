-- this function tells how many seats are free in a workshop
-- it reads the workshop limit and counts active enrollments from all its cycles
-- if the limit is zero it means no cap so it returns 0

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE OR ALTER FUNCTION dbo.fn_GetAvailableSeats
(
    @WorkshopId INT
)
RETURNS INT
AS
BEGIN
    DECLARE @maxParticipants INT;
    DECLARE @currentEnrollments INT;
    DECLARE @available INT;

    SELECT @maxParticipants = MaxParticipants
    FROM dbo.Workshops
    WHERE Id = @WorkshopId;

    SELECT @currentEnrollments = COUNT(*)
    FROM dbo.Enrollments e
    INNER JOIN dbo.WorkshopCycles c ON e.WorkshopCycleId = c.Id
    WHERE c.WorkshopId = @WorkshopId
      AND e.Status IS NOT NULL
      AND UPPER(e.Status) = 'ACTIVE';

    IF (@maxParticipants IS NULL OR @maxParticipants = 0)
    BEGIN
        SET @available = 0;
    END
    ELSE
    BEGIN
        SET @available = @maxParticipants - ISNULL(@currentEnrollments, 0);
        IF (@available < 0)
            SET @available = 0;
    END

    RETURN @available;
END;
GO
