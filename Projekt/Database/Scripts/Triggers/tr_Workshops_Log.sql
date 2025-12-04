IF OBJECT_ID('dbo.tr_Workshops_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Workshops_Log;
GO
CREATE TRIGGER dbo.tr_Workshops_Log
ON dbo.Workshops
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- INSERT
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'WORKSHOP_CREATED',
           CONCAT('Workshop ', i.Id, ' created: ', ISNULL(i.Title,'<no title>'), ', price ', ISNULL(CONVERT(varchar(50), i.Price),'0'), ', max ', ISNULL(CONVERT(varchar(50), i.MaxParticipants),'0')),
           SYSUTCDATETIME()
    FROM inserted i;

    -- UPDATE general
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'WORKSHOP_UPDATED',
           CONCAT('Workshop ', i.Id, ' updated: ',
                  CASE WHEN ISNULL(d.Title,'') <> ISNULL(i.Title,'') THEN CONCAT('Title ', ISNULL(d.Title,'<null>'), ' -> ', ISNULL(i.Title,'<null>'), '; ') ELSE '' END,
                  CASE WHEN ISNULL(d.Price,0) <> ISNULL(i.Price,0) THEN CONCAT('Price ', ISNULL(CONVERT(varchar(50), d.Price),'0'), ' -> ', ISNULL(CONVERT(varchar(50), i.Price),'0'), '; ') ELSE '' END,
                  CASE WHEN ISNULL(d.MaxParticipants,0) <> ISNULL(i.MaxParticipants,0) THEN CONCAT('MaxParticipants ', ISNULL(CONVERT(varchar(50), d.MaxParticipants),'0'), ' -> ', ISNULL(CONVERT(varchar(50), i.MaxParticipants),'0'), '; ') ELSE '' END
           ),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE ISNULL(d.Title,'') <> ISNULL(i.Title,'')
       OR ISNULL(d.Price,0) <> ISNULL(i.Price,0)
       OR ISNULL(d.MaxParticipants,0) <> ISNULL(i.MaxParticipants,0);

    -- Image uploaded
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'WORKSHOP_IMAGE_UPLOADED',
           CONCAT('Workshop ', i.Id, ' image uploaded: ', ISNULL(i.ImageUrl,'<null>'), ', thumb ', ISNULL(i.ThumbnailUrl,'<null>')),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE (ISNULL(d.ImageUrl,'') = '' AND ISNULL(i.ImageUrl,'') <> '')
       OR (ISNULL(d.ThumbnailUrl,'') = '' AND ISNULL(i.ThumbnailUrl,'') <> '');

    -- Photo edited
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'PHOTO_EDITED',
           CONCAT('Workshop ', i.Id, ' image changed: ', ISNULL(d.ImageUrl,'<null>'), ' -> ', ISNULL(i.ImageUrl,'<null>'), '; thumb ', ISNULL(d.ThumbnailUrl,'<null>'), ' -> ', ISNULL(i.ThumbnailUrl,'<null>')),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE (ISNULL(d.ImageUrl,'') <> '' AND ISNULL(i.ImageUrl,'') <> '' AND ISNULL(d.ImageUrl,'') <> ISNULL(i.ImageUrl,''))
       OR (ISNULL(d.ThumbnailUrl,'') <> '' AND ISNULL(i.ThumbnailUrl,'') <> '' AND ISNULL(d.ThumbnailUrl,'') <> ISNULL(i.ThumbnailUrl,''));
END
GO
