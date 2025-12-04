-- this function checks if a cycle is open for enrollment based on its dates and flag
-- it reads the cycle info from workshopcycles and returns 1 or 0

IF OBJECT_ID('dbo.fn_IsCycleOpen', 'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_IsCycleOpen;
GO

CREATE FUNCTION dbo.fn_IsCycleOpen(@CycleId INT)
RETURNS INT
AS
BEGIN
    DECLARE @Open INT = 0;
    DECLARE @StartDate DATETIME2;
    DECLARE @EndDate DATETIME2;
    DECLARE @Flag BIT;

    SELECT @StartDate = c.StartDate,
           @EndDate = c.EndDate,
           @Flag = c.IsOpenForEnrollment
    FROM dbo.WorkshopCycles c
    WHERE c.Id = @CycleId;

    IF (@Flag = 1)
    BEGIN
        IF (@StartDate IS NOT NULL AND SYSDATETIME() < @StartDate)
            SET @Open = 1;
        ELSE IF (@EndDate IS NOT NULL AND SYSDATETIME() < @EndDate)
            SET @Open = 1;
        ELSE IF (@StartDate IS NULL AND @EndDate IS NULL)
            SET @Open = 1;
    END

    RETURN @Open;
END
GO
