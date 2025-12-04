IF OBJECT_ID('dbo.tr_Categories_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Categories_Log;
GO
CREATE TRIGGER dbo.tr_Categories_Log
ON dbo.Categories
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- INSERT
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'CATEGORY_CREATED',
           CONCAT('Category ', i.Id, ' created: ', ISNULL(i.Name,'<null>')),
           SYSUTCDATETIME()
    FROM inserted i;

    -- UPDATE
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'CATEGORY_UPDATED',
           CONCAT('Category ', i.Id, ' updated.',
                  CASE WHEN ISNULL(d.Name,'') <> ISNULL(i.Name,'') THEN ' Name changed; ' ELSE '' END,
                  CASE WHEN ISNULL(d.Description,'') <> ISNULL(i.Description,'') THEN ' Description changed; ' ELSE '' END
           ),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE ISNULL(d.Name,'') <> ISNULL(i.Name,'')
       OR ISNULL(d.Description,'') <> ISNULL(i.Description,'');

    -- DELETE - now uses SESSION_CONTEXT
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'CATEGORY_DELETED',
           CONCAT('Category ', d.Id, ' deleted: ', ISNULL(d.Name, '<no name>')),
           SYSUTCDATETIME()
    FROM deleted d;
END
GO
