IF OBJECT_ID('dbo.tr_Reviews_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Reviews_Log;
GO
CREATE TRIGGER dbo.tr_Reviews_Log
ON dbo.Reviews
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- INSERT
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT ISNULL(@actor, i.UserId),
           'REVIEW_CREATED',
           CONCAT('Review ', i.Id, ' for workshop ', i.WorkshopId, ' created with rating ', i.Rating),
           SYSUTCDATETIME()
    FROM inserted i;

    -- UPDATE
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT ISNULL(@actor, d.UserId),
           'REVIEW_UPDATED',
           CONCAT('Review ', i.Id, ' updated: Rating ', ISNULL(CONVERT(varchar(10), d.Rating),'<null>'), ' -> ', ISNULL(CONVERT(varchar(10), i.Rating),'<null>'), '; Comment changed'),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE ISNULL(d.Rating,-1) <> ISNULL(i.Rating,-1)
       OR ISNULL(d.Comment,'') <> ISNULL(i.Comment,'');

    -- DELETE - now uses SESSION_CONTEXT
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'REVIEW_DELETED',
           CONCAT('Review ', d.Id, ' for workshop ', d.WorkshopId, ' deleted'),
           SYSUTCDATETIME()
    FROM deleted d;
END
GO
