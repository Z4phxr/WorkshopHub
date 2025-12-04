-- this proc cancels one enrollment so it is basically a quick way to mark it as not active anymore, 
-- it checks if the enrollment exists and if it is still active, 
-- then it sets status to cancelled and saves when it happened and who triggered it

IF OBJECT_ID('dbo.sp_CancelEnrollment', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_CancelEnrollment;
GO
CREATE PROCEDURE dbo.sp_CancelEnrollment
    @EnrollmentId INT,
    @ActorUserId INT = NULL,
    @Reason NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Enrollments WHERE Id = @EnrollmentId)
    BEGIN RAISERROR('Enrollment not found.',11,1); RETURN; END

    DECLARE @Status NVARCHAR(50);
    SELECT @Status = Status FROM dbo.Enrollments WHERE Id = @EnrollmentId;

    IF (LOWER(ISNULL(@Status,'')) <> 'active')
    BEGIN RAISERROR('Enrollment is not active.',11,1); RETURN; END

    UPDATE dbo.Enrollments
    SET Status = 'Cancelled', CancelledAt = GETUTCDATE()
    WHERE Id = @EnrollmentId;

    SELECT @EnrollmentId AS EnrollmentId, @Status AS PreviousStatus, 'Cancelled' AS NewStatus, GETUTCDATE() AS CancelledAt, @ActorUserId AS ActorUserId, @Reason AS Reason;
END
GO
