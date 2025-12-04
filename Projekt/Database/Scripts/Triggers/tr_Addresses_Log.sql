CREATE OR ALTER TRIGGER dbo.tr_Addresses_Log
ON dbo.Addresses
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- INSERT
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'ADDRESS_CREATED',
           CONCAT('Address ', i.Id, ' created: ', ISNULL(i.City,'<null>'), ', ', ISNULL(i.Street,'<null>'), ' ', ISNULL(i.BuildingNumber,'<null>')),
           SYSUTCDATETIME()
    FROM inserted i;

    -- UPDATE
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'ADDRESS_UPDATED',
           CONCAT('Address ', i.Id, ' updated: ',
                  CASE WHEN ISNULL(d.City,'') <> ISNULL(i.City,'') THEN CONCAT('City ', ISNULL(d.City,'<null>'), ' -> ', ISNULL(i.City,'<null>'), '; ') ELSE '' END,
                  CASE WHEN ISNULL(d.Street,'') <> ISNULL(i.Street,'') THEN CONCAT('Street ', ISNULL(d.Street,'<null>'), ' -> ', ISNULL(i.Street,'<null>'), '; ') ELSE '' END,
                  CASE WHEN ISNULL(d.BuildingNumber,'') <> ISNULL(i.BuildingNumber,'') THEN CONCAT('BuildingNumber ', ISNULL(d.BuildingNumber,'<null>'), ' -> ', ISNULL(i.BuildingNumber,'<null>'), '; ') ELSE '' END
           ),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE ISNULL(d.City,'') <> ISNULL(i.City,'')
       OR ISNULL(d.Street,'') <> ISNULL(i.Street,'')
       OR ISNULL(d.BuildingNumber,'') <> ISNULL(i.BuildingNumber,'');

    -- DELETE
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT NULL,
           'ADDRESS_DELETED',
           CONCAT('Address ', d.Id, ' deleted: ', ISNULL(d.City,'<null>'), ', ', ISNULL(d.Street,'<null>'), ' ', ISNULL(d.BuildingNumber,'<null>')),
           SYSUTCDATETIME()
    FROM deleted d;
END
