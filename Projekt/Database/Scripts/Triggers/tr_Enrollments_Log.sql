IF OBJECT_ID('dbo.tr_Enrollments_Insert_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Enrollments_Insert_Log;
GO

CREATE TRIGGER dbo.tr_Enrollments_Insert_Log
ON dbo.Enrollments
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- INSERT
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'ENROLLMENT_CREATED',
           CONCAT('User ', ISNULL(CONVERT(varchar(50), i.UserId), 'NULL'),
                  ' enrolled to cycle ', ISNULL(CONVERT(varchar(50), i.WorkshopCycleId), 'NULL'),
                  CASE WHEN c.WorkshopId IS NOT NULL THEN CONCAT(' (workshop id = ', c.WorkshopId, ')') ELSE '' END,
                  ' (enrollment id = ', ISNULL(CONVERT(varchar(50), i.Id), 'NULL'), ')'),
           SYSUTCDATETIME()
    FROM inserted i
    LEFT JOIN dbo.WorkshopCycles c ON c.Id = i.WorkshopCycleId;
END
GO

IF OBJECT_ID('dbo.tr_Enrollments_Update_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Enrollments_Update_Log;
GO
CREATE TRIGGER dbo.tr_Enrollments_Update_Log
ON dbo.Enrollments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- UPDATE
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'ENROLLMENT_CANCELLED',
           CONCAT('Enrollment ', i.Id, ' cancelled. Status: ', ISNULL(d.Status,'<null>'), ' -> ', ISNULL(i.Status,'<null>')),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE UPPER(ISNULL(i.Status,'')) = 'CANCELLED' AND UPPER(ISNULL(d.Status,'')) <> 'CANCELLED';

    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'ENROLLMENT_UPDATED',
           CONCAT('Enrollment ', i.Id, ' updated.'),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE (ISNULL(d.WorkshopCycleId,-1) <> ISNULL(i.WorkshopCycleId,-1)
        OR ISNULL(d.UserId,-1) <> ISNULL(i.UserId,-1))
      AND NOT (UPPER(ISNULL(i.Status,'')) = 'CANCELLED' AND UPPER(ISNULL(d.Status,'')) <> 'CANCELLED');
END
GO

IF OBJECT_ID('dbo.tr_Enrollments_Delete_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Enrollments_Delete_Log;
GO
CREATE TRIGGER dbo.tr_Enrollments_Delete_Log
ON dbo.Enrollments
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- DELETE - now uses SESSION_CONTEXT!
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'ENROLLMENT_DELETED',
           CONCAT('Enrollment ', d.Id, ' deleted for user ', d.UserId, ' cycle ', d.WorkshopCycleId),
           SYSUTCDATETIME()
    FROM deleted d;
END
GO

IF OBJECT_ID('dbo.tr_Cycle_Enrollments_Cancelled', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Cycle_Enrollments_Cancelled;
GO
CREATE TRIGGER dbo.tr_Cycle_Enrollments_Cancelled
ON dbo.Enrollments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- UPDATE
    ;WITH changed AS (
        SELECT i.WorkshopCycleId AS CycleId
        FROM inserted i
        JOIN deleted d ON d.Id = i.Id
        WHERE UPPER(ISNULL(i.Status,'')) = 'CANCELLED' AND UPPER(ISNULL(d.Status,'')) <> 'CANCELLED'
    ), agg AS (
        SELECT CycleId, COUNT(*) AS Cnt
        FROM changed
        GROUP BY CycleId
        HAVING COUNT(*) >= 2
    )
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'CYCLE_ENROLLMENTS_CANCELLED',
           CONCAT('Cycle ', a.CycleId, ': ', a.Cnt, ' enrollments cancelled in a single operation.'),
           SYSUTCDATETIME()
    FROM agg a;
END
GO
