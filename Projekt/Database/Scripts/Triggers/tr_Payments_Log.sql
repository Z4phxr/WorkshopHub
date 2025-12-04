-- Trigger for Payments table logging
IF OBJECT_ID('dbo.tr_Payments_Insert_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Payments_Insert_Log;
GO

CREATE TRIGGER dbo.tr_Payments_Insert_Log
ON dbo.Payments
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- LOG: Payment created
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'PAYMENT_CREATED',
           CONCAT('Payment ', i.Id, ' created for enrollment ', i.EnrollmentId, 
                  ', amount ', CAST(i.Amount AS VARCHAR(20)), 
                  ', status ', ISNULL(i.Status, 'NULL')),
           SYSUTCDATETIME()
    FROM inserted i;
END
GO

IF OBJECT_ID('dbo.tr_Payments_Update_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Payments_Update_Log;
GO

CREATE TRIGGER dbo.tr_Payments_Update_Log
ON dbo.Payments
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- LOG: Payment status changed to Paid
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'PAYMENT_MARKED_PAID',
           CONCAT('Payment ', i.Id, ' marked as Paid. Enrollment ', i.EnrollmentId, 
                  ', amount ', CAST(i.Amount AS VARCHAR(20))),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE UPPER(ISNULL(i.Status, '')) = 'PAID' 
      AND UPPER(ISNULL(d.Status, '')) <> 'PAID';

    -- LOG: Payment updated (other changes)
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'PAYMENT_UPDATED',
           CONCAT('Payment ', i.Id, ' updated. ',
                  CASE WHEN d.Amount <> i.Amount THEN CONCAT('Amount: ', CAST(d.Amount AS VARCHAR(20)), ' ? ', CAST(i.Amount AS VARCHAR(20)), '; ') ELSE '' END,
                  CASE WHEN ISNULL(d.Status, '') <> ISNULL(i.Status, '') 
                       AND NOT (UPPER(ISNULL(i.Status, '')) = 'PAID' AND UPPER(ISNULL(d.Status, '')) <> 'PAID')
                       THEN CONCAT('Status: ', ISNULL(d.Status, 'NULL'), ' ? ', ISNULL(i.Status, 'NULL'), '; ') ELSE '' END,
                  CASE WHEN ISNULL(d.Method, '') <> ISNULL(i.Method, '') THEN CONCAT('Method: ', ISNULL(d.Method, 'NULL'), ' ? ', ISNULL(i.Method, 'NULL')) ELSE '' END
           ),
           SYSUTCDATETIME()
    FROM inserted i
    JOIN deleted d ON d.Id = i.Id
    WHERE (d.Amount <> i.Amount
       OR ISNULL(d.Method, '') <> ISNULL(i.Method, ''))
      AND NOT (UPPER(ISNULL(i.Status, '')) = 'PAID' AND UPPER(ISNULL(d.Status, '')) <> 'PAID');
END
GO

IF OBJECT_ID('dbo.tr_Payments_Delete_Log', 'TR') IS NOT NULL
    DROP TRIGGER dbo.tr_Payments_Delete_Log;
GO

CREATE TRIGGER dbo.tr_Payments_Delete_Log
ON dbo.Payments
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actor INT = TRY_CAST(SESSION_CONTEXT(N'AppUserId') AS INT);

    -- LOG: Payment deleted
    INSERT INTO dbo.Logs (UserId, Action, Details, CreatedAt)
    SELECT @actor,
           'PAYMENT_DELETED',
           CONCAT('Payment ', d.Id, ' deleted for enrollment ', d.EnrollmentId, 
                  ', amount ', CAST(d.Amount AS VARCHAR(20)), 
                  ', status was ', ISNULL(d.Status, 'NULL')),
           SYSUTCDATETIME()
    FROM deleted d;
END
GO
