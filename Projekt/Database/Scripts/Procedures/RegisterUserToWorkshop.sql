-- this proc handles safe user registration into a cycle, it checks capacity open flag duplicates and price rules all in a single serializable tx
-- it mirrors the backend logic used when user joins a cycle so the behavior stays consistent
-- returns enrollment id and maybe a payment if there is a price

if object_id('dbo.sp_RegisterUserToWorkshop','P') is not null
    drop procedure dbo.sp_RegisterUserToWorkshop;
go

create procedure dbo.sp_RegisterUserToWorkshop
    @UserId int,
    @WorkshopCycleId int
as
begin
    set nocount on;

    if @UserId is null or @WorkshopCycleId is null
    begin
        raiserror('UserId and WorkshopCycleId are required.', 16, 1);
        return;
    end

    begin try
        set xact_abort on;
        set transaction isolation level serializable;
        begin transaction;

        declare @WorkshopId int;
        declare @IsOpen bit;
        declare @CycleMax int;
        declare @WorkshopMax int;
        declare @Price decimal(18,2);

        -- load base workshop and cycle info
        select 
            @WorkshopId = c.WorkshopId,
            @IsOpen = c.IsOpenForEnrollment,
            @CycleMax = c.MaxParticipantsOverride
        from dbo.WorkshopCycles c
        where c.Id = @WorkshopCycleId;

        if @WorkshopId is null
        begin
            rollback transaction;
            raiserror('WorkshopCycle does not exist.', 16, 1);
            return;
        end

        select 
            @WorkshopMax = w.MaxParticipants, 
            @Price = w.Price
        from dbo.Workshops w
        where w.Id = @WorkshopId;

        -- check if the cycle is actually open
        if isnull(@IsOpen, 0) = 0
        begin
            rollback transaction;
            raiserror('Cycle is closed for enrollment.', 16, 1);
            return;
        end

        -- capacity calc, using override if present
        declare @EffectiveCapacity int = isnull(@CycleMax, @WorkshopMax);
        if @EffectiveCapacity > 0
        begin
            declare @ActiveCount int;
            select @ActiveCount = count(*)
            from dbo.Enrollments e with (updlock, holdlock)
            where e.WorkshopCycleId = @WorkshopCycleId
              and lower(isnull(e.Status,'')) = 'active';

            if @ActiveCount >= @EffectiveCapacity
            begin
                rollback transaction;
                raiserror('No seats available for this cycle.', 16, 1);
                return;
            end
        end

        -- prevent duplicate active enrollment
        if exists(
            select 1 from dbo.Enrollments e with (updlock, holdlock)
            where e.UserId = @UserId
              and e.WorkshopCycleId = @WorkshopCycleId
              and lower(isnull(e.Status,'')) = 'active'
        )
        begin
            rollback transaction;
            raiserror('User is already enrolled for this cycle.', 16, 1);
            return;
        end

        -- create the enrollment row
        insert into dbo.Enrollments (UserId, WorkshopCycleId, EnrolledAt, Status)
        values (@UserId, @WorkshopCycleId, sysutcdatetime(), 'Active');

        declare @EnrollmentId int = scope_identity();
        declare @PaymentId int = null;
        declare @Amount decimal(18,2) = null;

        -- create pending payment if the workshop costs money
        if @Price is not null and @Price > 0
        begin
            insert into dbo.Payments (EnrollmentId, Amount, Status, CreatedAt)
            values (@EnrollmentId, @Price, 'Pending', sysutcdatetime());

            set @PaymentId = scope_identity();
            set @Amount = @Price;
        end

        commit transaction;

        -- return result
        select 
            @EnrollmentId as EnrollmentId, 
            @PaymentId as PaymentId, 
            @Amount as Amount;
    end try
    begin catch
        if xact_state() <> 0
        begin
            begin try rollback transaction; end try begin catch end catch;
        end
        declare @ErrMsg nvarchar(4000) = error_message();
        raiserror(@ErrMsg, 16, 1);
        return;
    end catch
end
go
