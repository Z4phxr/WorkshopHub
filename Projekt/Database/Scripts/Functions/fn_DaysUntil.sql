-- this function tells how many days are left until a given date
-- it uses utc time and can return negative values if the date already passed

IF OBJECT_ID('dbo.fn_DaysUntil', 'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_DaysUntil;
GO

CREATE FUNCTION dbo.fn_DaysUntil(@dt DATETIME2)
RETURNS INT
AS
BEGIN
    RETURN DATEDIFF(day, GETUTCDATE(), @dt);
END
GO
