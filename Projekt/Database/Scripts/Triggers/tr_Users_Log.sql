IF OBJECT_ID('dbo.tr_Users_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Users_Log;
GO
CREATE TRIGGER dbo.tr_Users_Log
ON dbo.Users
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- UPDATE: actor performs the update
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'USER_UPDATED',
           CONCAT('User ', d.Id, ' updated: ',
                  CASE WHEN ISNULL(d.FirstName,'') <> ISNULL(i.FirstName,'') THEN CONCAT('FirstName ', ISNULL(d.FirstName,'<null>'), ' -> ', ISNULL(i.FirstName,'<null>'), '; ') ELSE '' END,
                  CASE WHEN ISNULL(d.LastName,'') <> ISNULL(i.LastName,'') THEN CONCAT('LastName ', ISNULL(d.LastName,'<null>'), ' -> ', ISNULL(i.LastName,'<null>'), '; ') ELSE '' END,
                  CASE WHEN ISNULL(d.Email,'') <> ISNULL(i.Email,'') THEN CONCAT('Email ', ISNULL(d.Email,'<null>'), ' -> ', ISNULL(i.Email,'<null>'), '; ') ELSE '' END
           ),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE ISNULL(d.FirstName,'') <> ISNULL(i.FirstName,'')
       OR ISNULL(d.LastName,'') <> ISNULL(i.LastName,'')
       OR ISNULL(d.Email,'') <> ISNULL(i.Email,'');

    -- DELETE: UserId must be NULL to avoid FK conflict, but include actor in details
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT NULL,
           'USER_DELETED',
           CONCAT('User deleted: ', ISNULL(d.Email,'<no email>'), ' (Id=', d.Id, ')', 
                  CASE WHEN @actor IS NOT NULL THEN CONCAT(' by user ', @actor) ELSE '' END),
           SYSUTCDATETIME()
    FROM deleted d;
END
GO
