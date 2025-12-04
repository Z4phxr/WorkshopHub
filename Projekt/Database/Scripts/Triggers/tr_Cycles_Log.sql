-- Trigger for WorkshopCycles table logging
IF OBJECT_ID('dbo.tr_Cycles_Insert_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Cycles_Insert_Log;
GO

CREATE TRIGGER dbo.tr_Cycles_Insert_Log
ON dbo.WorkshopCycles
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- LOG: Cycle created
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'CYCLE_CREATED',
           CONCAT('Cycle ', i.Id, ' created for workshop ', i.WorkshopId, 
                  ', name: ', ISNULL(i.DisplayName, '<null>')),
           SYSUTCDATETIME()
    FROM inserted i;
END
GO

IF OBJECT_ID('dbo.tr_Cycles_Update_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Cycles_Update_Log;
GO

CREATE TRIGGER dbo.tr_Cycles_Update_Log
ON dbo.WorkshopCycles
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- LOG: Cycle updated
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'CYCLE_UPDATED',
           CONCAT('Cycle ', i.Id, ' updated. ',
                  CASE WHEN ISNULL(d.DisplayName, '') <> ISNULL(i.DisplayName, '') 
                       THEN CONCAT('Name: ', ISNULL(d.DisplayName, '<null>'), ' ? ', ISNULL(i.DisplayName, '<null>'), '; ') ELSE '' END,
                  CASE WHEN d.IsOpenForEnrollment <> i.IsOpenForEnrollment 
                       THEN CONCAT('Open: ', CAST(d.IsOpenForEnrollment AS VARCHAR), ' ? ', CAST(i.IsOpenForEnrollment AS VARCHAR), '; ') ELSE '' END
           ),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE ISNULL(d.DisplayName, '') <> ISNULL(i.DisplayName, '')
       OR d.IsOpenForEnrollment <> i.IsOpenForEnrollment
       OR ISNULL(d.MaxParticipantsOverride, 0) <> ISNULL(i.MaxParticipantsOverride, 0);
END
GO

IF OBJECT_ID('dbo.tr_Cycles_Delete_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Cycles_Delete_Log;
GO

CREATE TRIGGER dbo.tr_Cycles_Delete_Log
ON dbo.WorkshopCycles
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- LOG: Cycle deleted
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'CYCLE_DELETED',
           CONCAT('Cycle ', d.Id, ' deleted for workshop ', d.WorkshopId),
           SYSUTCDATETIME()
    FROM deleted d;
END
GO
