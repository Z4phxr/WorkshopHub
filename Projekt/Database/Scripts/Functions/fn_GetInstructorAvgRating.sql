-- this function finds the average rating for one instructor
-- it checks all sessions they taught and uses the review scores from those workshops
-- if there are no reviews it just returns 0

CREATE FUNCTION dbo.fn_GetInstructorAvgRating
(
    @InstructorId INT
)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @avg DECIMAL(5,2);

    SELECT @avg = AVG(CAST(r.Rating AS DECIMAL(5,2)))
    FROM WorkshopSessionInstructors wsi
    INNER JOIN WorkshopSessions ws
        ON wsi.WorkshopSessionId = ws.Id
    INNER JOIN Workshops w
        ON ws.WorkshopId = w.Id
    INNER JOIN Reviews r
        ON r.WorkshopId = w.Id
    WHERE wsi.InstructorId = @InstructorId;

    IF (@avg IS NULL)
        SET @avg = 0;

    RETURN @avg;
END;
GO
