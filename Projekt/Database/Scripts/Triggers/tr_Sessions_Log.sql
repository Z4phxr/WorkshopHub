-- Trigger for WorkshopSessions table logging
IF OBJECT_ID('dbo.tr_Sessions_Insert_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Sessions_Insert_Log;
GO

CREATE TRIGGER dbo.tr_Sessions_Insert_Log
ON dbo.WorkshopSessions
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- LOG: Session created
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'SESSION_CREATED',
           CONCAT('Session ', i.Id, ' created for cycle ', i.WorkshopCycleId, 
                  ', topic: ', ISNULL(i.Topic, '<null>')),
           SYSUTCDATETIME()
    FROM inserted i;
END
GO

IF OBJECT_ID('dbo.tr_Sessions_Update_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Sessions_Update_Log;
GO

CREATE TRIGGER dbo.tr_Sessions_Update_Log
ON dbo.WorkshopSessions
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- LOG: Session updated
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'SESSION_UPDATED',
           CONCAT('Session ', i.Id, ' updated. ',
                  CASE WHEN ISNULL(d.Topic, '') <> ISNULL(i.Topic, '') 
                       THEN CONCAT('Topic: ', ISNULL(d.Topic, '<null>'), ' ? ', ISNULL(i.Topic, '<null>'), '; ') ELSE '' END
           ),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE ISNULL(d.Topic, '') <> ISNULL(i.Topic, '')
       OR d.StartTime <> i.StartTime
       OR d.EndTime <> i.EndTime;
END
GO

IF OBJECT_ID('dbo.tr_Sessions_Delete_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Sessions_Delete_Log;
GO

CREATE TRIGGER dbo.tr_Sessions_Delete_Log
ON dbo.WorkshopSessions
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- LOG: Session deleted
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'SESSION_DELETED',
           CONCAT('Session ', d.Id, ' deleted for cycle ', d.WorkshopCycleId),
           SYSUTCDATETIME()
    FROM deleted d;
END
GO
