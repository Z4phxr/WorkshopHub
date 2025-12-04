using Microsoft.EntityFrameworkCore;
using Projekt.Models;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using System.Collections.Generic;
using Projekt.Services;
using System;
using Microsoft.AspNetCore.Http;

namespace Projekt.Data
{
    public class AppDbContext : DbContext
    {
        private readonly IHttpContextAccessor? _httpContextAccessor;
        private static readonly AsyncLocal<bool> _suppressSessionContext = new AsyncLocal<bool>();
        public static void SuppressSessionContext() => _suppressSessionContext.Value = true;
        public static void RestoreSessionContext() => _suppressSessionContext.Value = false;
        public static bool IsSessionContextSuppressed => _suppressSessionContext.Value;

        public AppDbContext(DbContextOptions<AppDbContext> options, IHttpContextAccessor? httpContextAccessor = null)
            : base(options)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<UserRole> UserRoles { get; set; }

        public DbSet<Category> Categories { get; set; }
        public DbSet<Address> Addresses { get; set; }

        public DbSet<Workshop> Workshops { get; set; }
        public DbSet<WorkshopCycle> WorkshopCycles { get; set; }
        public DbSet<WorkshopSession> WorkshopSessions { get; set; }
        public DbSet<InstructorAssignment> InstructorAssignments { get; set; }

        public DbSet<Enrollment> Enrollments { get; set; }
        public DbSet<Payment> Payments { get; set; }

        public DbSet<Review> Reviews { get; set; }
        public DbSet<Log> Logs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>().ToTable(tb => { 
                tb.HasTrigger("tr_Users_Log");
            });

            modelBuilder.Entity<Category>().ToTable(tb => { 
                tb.HasTrigger("tr_Categories_Log");
            });

            modelBuilder.Entity<Address>().ToTable(tb => { 
                tb.HasTrigger("tr_Addresses_Log");
            });

            modelBuilder.Entity<WorkshopCycle>().ToTable(tb => { 
                tb.HasTrigger("tr_WorkshopCycles_Log");
            });

            modelBuilder.Entity<WorkshopSession>().ToTable(tb => { 
                tb.HasTrigger("tr_WorkshopSessions_Log");
            });

            modelBuilder.Entity<Workshop>().ToTable(tb => { 
                tb.HasTrigger("tr_Workshops_Log");
            });

            modelBuilder.Entity<Enrollment>().ToTable(tb => {
                tb.HasTrigger("tr_Enrollments_Insert_Log");
                tb.HasTrigger("tr_Enrollments_Update_Log");
                tb.HasTrigger("tr_Enrollments_Delete_Log");
                tb.HasTrigger("tr_Cycle_Enrollments_Cancelled");
            });

            modelBuilder.Entity<Payment>().ToTable(tb => {
                tb.HasTrigger("tr_Payments_Insert_Log");
                tb.HasTrigger("tr_Payments_Update_Log");
                tb.HasTrigger("tr_Payments_Delete_Log");
            });

            modelBuilder.Entity<Review>().ToTable(tb => { 
                tb.HasTrigger("tr_Reviews_Log");
                tb.HasTrigger("tr_Reviews_RecalculateWorkshopRating");
            });

            modelBuilder.Entity<UserRole>(eb => {
                eb.HasKey(ur => new { ur.UserId, ur.RoleId });
                eb.HasOne(ur => ur.User).WithMany(u => u.UserRoles).HasForeignKey(ur => ur.UserId).OnDelete(DeleteBehavior.Cascade);
                eb.HasOne(ur => ur.Role).WithMany(r => r.UserRoles).HasForeignKey(ur => ur.RoleId).OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<WorkshopCycle>()
                .HasOne(c => c.Workshop)
                .WithMany(w => w.Cycles)
                .HasForeignKey(c => c.WorkshopId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<WorkshopSession>()
                .HasOne(s => s.WorkshopCycle)
                .WithMany(c => c.Sessions)
                .HasForeignKey(s => s.WorkshopCycleId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<WorkshopCycle>()
                .HasOne(c => c.Address)
                .WithMany()
                .HasForeignKey(c => c.AddressId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<WorkshopSession>()
                .HasOne(s => s.Address)
                .WithMany()
                .HasForeignKey(s => s.AddressId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Enrollment>()
                .HasOne(e => e.WorkshopCycle)
                .WithMany(c => c.Enrollments)
                .HasForeignKey(e => e.WorkshopCycleId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Workshop>()
                .Property(w => w.DefaultInstructorId)
                .IsRequired(false);

            modelBuilder.Entity<Workshop>()
                .HasOne(w => w.Address)
                .WithMany(a => a.Workshops)
                .HasForeignKey(w => w.AddressId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Workshop>()
                .HasOne(w => w.Category)
                .WithMany(c => c.Workshops)
                .HasForeignKey(w => w.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<InstructorAssignment>().ToTable("InstructorAssignments");
            modelBuilder.Entity<InstructorAssignment>()
                .HasOne(a => a.Instructor)
                .WithMany()
                .HasForeignKey(a => a.InstructorId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<InstructorAssignment>().HasIndex(a => a.WorkshopId);
            modelBuilder.Entity<InstructorAssignment>().HasIndex(a => a.WorkshopCycleId);
            modelBuilder.Entity<InstructorAssignment>().HasIndex(a => a.WorkshopSessionId);

            modelBuilder.Entity<Payment>()
                .Property(p => p.Amount)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Workshop>()
                .Property(w => w.Price)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Workshop>()
                .Property(w => w.AverageRating)
                .HasPrecision(5, 2);

            modelBuilder.Entity<Enrollment>()
                .HasIndex(e => new { e.UserId, e.WorkshopCycleId })
                .IsUnique();

            modelBuilder.Entity<Workshop>()
                .HasOne(w => w.DefaultInstructor)
                .WithMany()
                .HasForeignKey(w => w.DefaultInstructorId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Log>()
                .HasOne(l => l.User)
                .WithMany(u => u.Logs)
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Role>().HasData(
                new Role { Id = 1, Name = "Admin", Description = "Administrator with full privileges" },
                new Role { Id = 2, Name = "Instructor", Description = "Workshop instructor role" },
                new Role { Id = 3, Name = "Participant", Description = "Default participant role" }
            );

            modelBuilder.Entity<Category>().HasData(
                new Category { Id = 1001, Name = "Music", Description = "Workshops focused on instrumental, vocal and rhythm skills." },
                new Category { Id = 1002, Name = "Painting", Description = "Art and creative expression through various painting techniques." },
                new Category { Id = 1003, Name = "Photography", Description = "Workshops for learning digital and analog photography." },
                new Category { Id = 1004, Name = "Cooking", Description = "Culinary workshops focused on practical cooking skills." },
                new Category { Id = 1005, Name = "Handcraft", Description = "Creative hand-made crafting workshops: ceramics, sewing, DIY." },
                new Category { Id = 1006, Name = "Digital Art", Description = "Workshops teaching digital illustration, design and graphic tools." }
            );

            modelBuilder.Entity<WorkshopCycle>().HasIndex(c => c.WorkshopId).HasDatabaseName("IX_WorkshopCycles_WorkshopId");
            modelBuilder.Entity<WorkshopSession>().HasIndex(s => s.WorkshopCycleId).HasDatabaseName("IX_WorkshopSessions_WorkshopCycleId");
            modelBuilder.Entity<Enrollment>().HasIndex(e => e.WorkshopCycleId).HasDatabaseName("IX_Enrollments_WorkshopCycleId");
            modelBuilder.Entity<Payment>().HasIndex(p => p.EnrollmentId).HasDatabaseName("IX_Payments_EnrollmentId");
            modelBuilder.Entity<Review>().HasIndex(r => r.WorkshopId).HasDatabaseName("IX_Reviews_WorkshopId");
        }

        private async Task EnsureSessionContextAsync()
        {
            try
            {
                if (_suppressSessionContext.Value) return; // skip setting AppUserId in session context

                var conn = this.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open)
                {
                    await conn.OpenAsync();
                }
                var user = _httpContextAccessor?.HttpContext?.User;
                await SessionContextHelper.SetAppUserIdAsync(conn, user);
            }
            catch { }
        }

        public override int SaveChanges()
        {
            EnsureSessionContextAsync().GetAwaiter().GetResult();
            return base.SaveChanges();
        }
        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return SaveChangesWithSessionAsync(cancellationToken);
        }

        private async Task<int> SaveChangesWithSessionAsync(CancellationToken cancellationToken)
        {
            await EnsureSessionContextAsync();
            return await base.SaveChangesAsync(cancellationToken);
        }
    }
}
