IF OBJECT_ID('dbo.tr_Reviews_RecalculateWorkshopRating', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Reviews_RecalculateWorkshopRating;
GO
CREATE TRIGGER dbo.tr_Reviews_RecalculateWorkshopRating
ON dbo.Reviews
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH affected AS (
        SELECT DISTINCT WorkshopId FROM inserted WHERE WorkshopId IS NOT NULL
        UNION
        SELECT DISTINCT WorkshopId FROM deleted WHERE WorkshopId IS NOT NULL
    )
    UPDATE w
    SET w.AverageRating = x.AvgRating
    FROM dbo.Workshops w
    INNER JOIN (
        SELECT a.WorkshopId,
               CASE WHEN COUNT(rv.Rating) = 0 THEN NULL
                    ELSE ROUND(AVG(CAST(rv.Rating AS DECIMAL(5,2))), 2)
               END AS AvgRating
        FROM affected a
        LEFT JOIN dbo.Reviews rv ON rv.WorkshopId = a.WorkshopId
        GROUP BY a.WorkshopId
    ) x ON x.WorkshopId = w.Id;
END
GO
