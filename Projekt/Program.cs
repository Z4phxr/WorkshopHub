using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore; // fixed: was Microsoft.EntityCore
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Projekt.Data;
using Projekt.Models;
using System.Text.RegularExpressions;
using Projekt.Services;

// WAŻNE: Wyłącz domyślne mapowanie claim types przez JWT
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);

// Explicit URLs: serve HTTPS on 7271 to match frontend config, plus default HTTP 5000
builder.WebHost.UseUrls("https://localhost:7271", "http://localhost:5000");

// Configure JSON serializer to ignore cycles
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDev", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddHttpsRedirection(options =>
{
    options.HttpsPort = 7271;
});

builder.Services.AddHttpContextAccessor();

// Register interceptor that sets SESSION_CONTEXT(AppUserId) for SQL triggers
builder.Services.AddSingleton<DbConnectionInterceptor, SessionContextConnectionInterceptor>();

// Use only AddDbContext (scoped) to avoid duplicate registrations
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
    var interceptor = sp.GetService<DbConnectionInterceptor>();
    if (interceptor != null) options.AddInterceptors(interceptor);
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Projekt v1", Version = "v1" });

    // Use HTTP Bearer scheme so Swagger UI will add the "Bearer " prefix automatically
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: 'Bearer {token}'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    var jwtSettings = builder.Configuration.GetSection("Jwt");
    var key = jwtSettings["Key"] ?? throw new InvalidOperationException("JWT Key is not configured");
    var issuer = jwtSettings["Issuer"] ?? throw new InvalidOperationException("JWT Issuer is not configured");
    var audience = jwtSettings["Audience"] ?? throw new InvalidOperationException("JWT Audience is not configured");

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = issuer,
        ValidAudience = audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
        ClockSkew = TimeSpan.FromMinutes(5),
        NameClaimType = ClaimTypes.NameIdentifier,
        RoleClaimType = ClaimTypes.Role
    };

    options.Events = new JwtBearerEvents();
});

builder.Services.AddAuthorization();

// Audit logger service registration
builder.Services.AddScoped<Projekt.Services.IAuditLogger, Projekt.Services.AuditLogger>();

// Global error handling + ProblemDetails response
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = ctx =>
    {
        ctx.ProblemDetails.Extensions["traceId"] = ctx.HttpContext.TraceIdentifier;
    };
});

var app = builder.Build();

// Global exception handler middleware (returns RFC7807 ProblemDetails)
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var feature = context.Features.Get<IExceptionHandlerPathFeature>();
        var problem = new ProblemDetails
        {
            Title = "An unexpected error occurred.",
            Status = StatusCodes.Status500InternalServerError,
            Detail = app.Environment.IsDevelopment() ? feature?.Error.Message : "Internal server error",
            Instance = context.Request.Path
        };
        problem.Extensions["traceId"] = context.TraceIdentifier;
        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode = problem.Status!.Value;

        try
        {
            var audit = context.RequestServices.GetService(typeof(Projekt.Services.IAuditLogger)) as Projekt.Services.IAuditLogger;
            if (audit != null)
            {
                try { await audit.LogForHttpAsync(context, "UNHANDLED_EXCEPTION", feature?.Error.ToString() ?? "No exception details"); } catch { }
            }
        }
        catch { }

        await context.Response.WriteAsJsonAsync(problem);
    });
});

// Apply EF Core migrations at startup to ensure schema is up to date
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetService<Microsoft.Extensions.Logging.ILoggerFactory>()?.CreateLogger("StartupSqlScripts");

    async Task<bool> TableExists(string tableName)
    {
        try
        {
            var conn = db.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"SELECT CASE WHEN OBJECT_ID('dbo.{tableName}','U') IS NOT NULL THEN 1 ELSE 0 END";
            var res = await cmd.ExecuteScalarAsync();
            await conn.CloseAsync();
            return Convert.ToInt32(res) == 1;
        }
        catch { return false; }
    }

    // Apply EF Core migrations at startup to ensure schema is up to date
    try
    {
        logger?.LogInformation("Applying EF Core migrations at startup...");
        db.Database.Migrate();
        logger?.LogInformation("Migrations applied successfully.");
    }
    catch (Exception exMigrate)
    {
        logger?.LogError(exMigrate, "Failed to apply migrations at startup.");
        throw; // rethrow to fail fast if schema cannot be ensured
    }

    // Seed lookup data remains unchanged (existing runtime/HasData seeds are preserved)
    try
    {
        /*
        // Runtime seeding DISABLED: Roles and Categories are seeded via HasData/migrations; Addresses via migration seed.
        if (await TableExists("Addresses") && !db.Addresses.Any())
        {
            db.Addresses.AddRange(
                new Address { Id = 50, City = "Kraków", Street = "ul. Floriańska", BuildingNumber = "12", Room = "1", AdditionalInfo = "Stare Miasto" },
                new Address { Id = 51, City = "Kraków", Street = "ul. Grodzka", BuildingNumber = "25", Room = "2", AdditionalInfo = "Blisko Wawelu" },
                new Address { Id = 52, City = "Kraków", Street = "ul. Długa", BuildingNumber = "7", Room = "101", AdditionalInfo = "Wejście od podwórza" },
                new Address { Id = 53, City = "Kraków", Street = "ul. Karmelicka", BuildingNumber = "3A", Room = "Sala szkoleniowa", AdditionalInfo = "2 piętro" },
                new Address { Id = 54, City = "Warszawa", Street = "ul. Marszałkowska", BuildingNumber = "89", Room = "A", AdditionalInfo = "Śródmieście" },
                new Address { Id = 55, City = "Warszawa", Street = "ul. Świętokrzyska", BuildingNumber = "15", Room = "B", AdditionalInfo = "Metro Centrum" },
                new Address { Id = 56, City = "Warszawa", Street = "ul. Mokotowska", BuildingNumber = "44", Room = "3", AdditionalInfo = "Kamienica" },
                new Address { Id = 57, City = "Warszawa", Street = "ul. Puławska", BuildingNumber = "120", Room = "Sala 2", AdditionalInfo = "Parking z tyłu" }
            );
            await db.SaveChangesAsync();
            logger?.LogInformation("Seeded Addresses table.");
        }
        */
    }
    catch (Exception exSeedLookup)
    {
        logger?.LogError(exSeedLookup, "Failed while seeding lookup data after migrations.");
    }

    // Execute SQL files (procedures/functions/triggers) only if object does not already exist
    try
    {
        var baseDir = Directory.GetCurrentDirectory();
        var candidates = new[] {
            Path.Combine(baseDir, "Database", "Scripts", "Procedures"),
            Path.Combine(baseDir, "Projekt", "Database", "Scripts", "Procedures"),
            Path.Combine(baseDir, "Database", "Scripts", "Functions"),
            Path.Combine(baseDir, "Projekt", "Database", "Scripts", "Functions"),
            Path.Combine(baseDir, "Database", "Scripts", "Triggers"),
            Path.Combine(baseDir, "Projekt", "Database", "Scripts", "Triggers")
        };

        var executedAny = false;

        async Task<bool> ObjectExistsAsync(string type, string name)
        {
            try
            {
                var conn = db.Database.GetDbConnection();
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                switch (type)
                {
                    case "PROCEDURE":
                        cmd.CommandText = "SELECT 1 FROM sys.objects WHERE type IN ('P','PC') AND name = @n"; break;
                    case "FUNCTION":
                        cmd.CommandText = "SELECT 1 FROM sys.objects WHERE type IN ('FN','IF','TF') AND name = @n"; break;
                    case "TRIGGER":
                        cmd.CommandText = "SELECT 1 FROM sys.triggers WHERE name = @n"; break;
                    default:
                        cmd.CommandText = "SELECT 0"; break;
                }
                var p = cmd.CreateParameter(); p.ParameterName = "@n"; p.Value = name; cmd.Parameters.Add(p);
                var res = await cmd.ExecuteScalarAsync();
                await conn.CloseAsync();
                return res != null && int.TryParse(res.ToString(), out var i) && i == 1;
            }
            catch { return false; }
        }

        foreach (var c in candidates)
        {
            if (!Directory.Exists(c)) continue;
            executedAny = true;
            logger?.LogInformation("Scanning SQL scripts in: {path}", c);
            var files = Directory.GetFiles(c, "*.sql");
            foreach (var file in files)
            {
                try
                {
                    var sql = File.ReadAllText(file);
                    // Detect object type and name
                    var procMatch = Regex.Match(sql, @"CREATE\s+PROCEDURE\s+(?:\[dbo\]\.|dbo\.)?(\w+)", RegexOptions.IgnoreCase);
                    var funcMatch = Regex.Match(sql, @"CREATE\s+FUNCTION\s+(?:\[dbo\]\.|dbo\.)?(\w+)", RegexOptions.IgnoreCase);
                    var trigMatch = Regex.Match(sql, @"CREATE\s+TRIGGER\s+(\w+)", RegexOptions.IgnoreCase);

                    if (procMatch.Success)
                    {
                        var name = procMatch.Groups[1].Value;
                        if (await ObjectExistsAsync("PROCEDURE", name)) { logger?.LogInformation("Skipping procedure {name}: already exists.", name); continue; }
                    }
                    else if (funcMatch.Success)
                    {
                        var name = funcMatch.Groups[1].Value;
                        if (await ObjectExistsAsync("FUNCTION", name)) { logger?.LogInformation("Skipping function {name}: already exists.", name); continue; }
                    }
                    else if (trigMatch.Success)
                    {
                        var name = trigMatch.Groups[1].Value;
                        if (await ObjectExistsAsync("TRIGGER", name)) { logger?.LogInformation("Skipping trigger {name}: already exists.", name); continue; }
                    }

                    // Split into batches by GO and execute
                    var batches = Regex.Split(sql, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase);
                    foreach (var batch in batches)
                    {
                        var trimmed = batch.Trim();
                        if (string.IsNullOrWhiteSpace(trimmed)) continue;

                        // For triggers, ensure target table exists
                        try
                        {
                            var match = Regex.Match(trimmed, @"CREATE\s+TRIGGER\s+\S+\s+ON\s+(?:dbo\.)?([A-Za-z0-9_]+)", RegexOptions.IgnoreCase);
                            if (match.Success)
                            {
                                var targetTable = match.Groups[1].Value;
                                if (!await TableExists(targetTable))
                                {
                                    logger?.LogWarning("Skipping CREATE TRIGGER batch in {file} because target table dbo.{table} does not exist.", file, targetTable);
                                    continue;
                                }
                            }
                        }
                        catch (Exception exDetect)
                        {
                            logger?.LogWarning(exDetect, "Failed to detect trigger target table for batch in {file}; executing anyway.", file);
                        }

                        try { db.Database.ExecuteSqlRaw(trimmed); }
                        catch (Exception exRun) { logger?.LogWarning(exRun, "Failed to execute batch from {file}", file); }
                    }
                    logger?.LogInformation("Executed SQL file: {file}", file);
                }
                catch (Exception exFile)
                {
                    logger?.LogError(exFile, "Failed to process SQL file: {file}", file);
                }
            }
        }

        if (!executedAny)
        {
            logger?.LogInformation("No SQL folders found in candidates.");
        }
    }
    catch (Exception ex)
    {
        logger?.LogError(ex, "Error while attempting to create SQL stored procedures/functions/triggers at startup");
    }

    // Runtime seeding for users and workshop-related data DISABLED to use migrations as single source of truth.
    try
    {
        /*
        // Users
        if (await TableExists("Users") && !db.Users.Any())
        {
            db.Users.AddRange(
                new User { Id = 300, FirstName = "Admin", LastName = "User", Email = "admin@gmail.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("adminadmin"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 301, FirstName = "Emma", LastName = "Clark", Email = "emma.clark@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 302, FirstName = "Liam", LastName = "Foster", Email = "liam.foster@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 303, FirstName = "Olivia", LastName = "Hayes", Email = "olivia.hayes@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 304, FirstName = "Noah", LastName = "Reed", Email = "noah.reed@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 305, FirstName = "Ava", LastName = "Mitchell", Email = "ava.mitchell@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 306, FirstName = "Mason", LastName = "Turner", Email = "mason.turner@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 307, FirstName = "Sophia", LastName = "Bennett", Email = "sophia.bennett@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 308, FirstName = "Ethan", LastName = "Cole", Email = "ethan.cole@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 309, FirstName = "Isabella", LastName = "Parker", Email = "isabella.parker@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 310, FirstName = "Logan", LastName = "Murphy", Email = "logan.murphy@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 311, FirstName = "Mia", LastName = "Hughes", Email = "mia.hughes@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 312, FirstName = "Jacob", LastName = "Ward", Email = "jacob.ward@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 313, FirstName = "Charlotte", LastName = "Price", Email = "charlotte.price@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 314, FirstName = "Elijah", LastName = "Russell", Email = "elijah.russell@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 315, FirstName = "Harper", LastName = "Griffin", Email = "harper.griffin@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 316, FirstName = "Daniel", LastName = "Sanders", Email = "daniel.sanders@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 317, FirstName = "Amelia", LastName = "Ross", Email = "amelia.ross@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 318, FirstName = "Henry", LastName = "Peterson", Email = "henry.peterson@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) },
                new User { Id = 319, FirstName = "Grace", LastName = "Howard", Email = "grace.howard@example.com", PasswordHash = Projekt.Services.PasswordHasher.Hash("123456"), CreatedAt = new DateTime(2025,1,1,0,0,0,DateTimeKind.Utc) }
            );
            await db.SaveChangesAsync();
            logger?.LogInformation("Seeded Users table.");
        }

        // UserRoles
        if (await TableExists("UserRoles") && !db.UserRoles.Any())
        {
            db.UserRoles.AddRange(
                new UserRole { UserId = 300, RoleId = 1 },
                new UserRole { UserId = 300, RoleId = 2 },
                new UserRole { UserId = 301, RoleId = 2 },
                new UserRole { UserId = 302, RoleId = 2 },
                new UserRole { UserId = 303, RoleId = 2 },
                new UserRole { UserId = 304, RoleId = 2 },
                new UserRole { UserId = 305, RoleId = 3 },
                new UserRole { UserId = 306, RoleId = 3 },
                new UserRole { UserId = 307, RoleId = 3 },
                new UserRole { UserId = 308, RoleId = 3 },
                new UserRole { UserId = 309, RoleId = 3 },
                new UserRole { UserId = 310, RoleId = 3 },
                new UserRole { UserId = 311, RoleId = 3 },
                new UserRole { UserId = 312, RoleId = 3 },
                new UserRole { UserId = 313, RoleId = 3 },
                new UserRole { UserId = 314, RoleId = 3 },
                new UserRole { UserId = 315, RoleId = 3 },
                new UserRole { UserId = 316, RoleId = 3 },
                new UserRole { UserId = 317, RoleId = 3 },
                new UserRole { UserId = 318, RoleId = 3 },
                new UserRole { UserId = 319, RoleId = 3 }
            );
            await db.SaveChangesAsync();
            logger?.LogInformation("Seeded UserRoles table.");
        }

        // Workshops
        if (await TableExists("Workshops") && !db.Workshops.Any())
        {
            db.Workshops.AddRange(
                new Workshop { Id = 2000, Title = "Photography Basics", Description = "A beginner-friendly workshop...", IsSeries = false, Price = 190m, MaxParticipants = 12, CategoryId = 1003, AddressId = 52, DefaultInstructorId = 301, ImageUrl = "/workshop-images/photography_basics.jpg", ThumbnailUrl = "/workshop-images/photography_basics.jpg", AverageRating = 4.50m },
                new Workshop { Id = 2001, Title = "Acrylic Painting", Description = "A focused beginner program...", IsSeries = false, Price = 150m, MaxParticipants = 14, CategoryId = 1002, AddressId = 55, DefaultInstructorId = 302, ImageUrl = "/workshop-images/acrylic_painting.jpg", ThumbnailUrl = "/workshop-images/acrylic_painting.jpg", AverageRating = 4.50m },
                new Workshop { Id = 2002, Title = "Creative Writing", Description = "A guided workshop...", IsSeries = false, Price = 130m, MaxParticipants = 16, CategoryId = 1006, AddressId = 51, DefaultInstructorId = 303, ImageUrl = "/workshop-images/creative_writing.jpg", ThumbnailUrl = "/workshop-images/creative_writing.jpg", AverageRating = 5.00m },
                new Workshop { Id = 2003, Title = "4-Week Guitar Course", Description = "A focused beginner program...", IsSeries = true, Price = 480m, MaxParticipants = 14, CategoryId = 1001, AddressId = 50, DefaultInstructorId = 301, ImageUrl = "/workshop-images/guitar_course.jpg", ThumbnailUrl = "/workshop-images/guitar_course.jpg" }
            );
            await db.SaveChangesAsync();
            logger?.LogInformation("Seeded Workshops table.");
        }

        // Cycles
        if (await TableExists("WorkshopCycles") && !db.WorkshopCycles.Any())
        {
            db.WorkshopCycles.AddRange(
                new WorkshopCycle { Id = 2100, WorkshopId = 2000, DisplayName = "Photography Basics – Sept 10 2025", StartDate = new DateTime(2025, 9, 10, 10, 0, 0, DateTimeKind.Utc), EndDate = new DateTime(2025, 9, 10, 13, 0, 0, DateTimeKind.Utc), IsOpenForEnrollment = false },
                new WorkshopCycle { Id = 2101, WorkshopId = 2000, DisplayName = "Photography Basics – Dec 15 2025", StartDate = new DateTime(2025, 12, 15, 10, 0, 0, DateTimeKind.Utc), EndDate = new DateTime(2025, 12, 15, 13, 0, 0, DateTimeKind.Utc), IsOpenForEnrollment = true },
                new WorkshopCycle { Id = 2102, WorkshopId = 2001, DisplayName = "Acrylic Painting – Aug 20 2025", StartDate = new DateTime(2025, 8, 20, 9, 0, 0, DateTimeKind.Utc), EndDate = new DateTime(2025, 8, 20, 12, 0, 0, DateTimeKind.Utc), IsOpenForEnrollment = false },
                new WorkshopCycle { Id = 2103, WorkshopId = 2001, DisplayName = "Acrylic Painting – Jan 18 2026", StartDate = new DateTime(2026, 1, 18, 9, 0, 0, DateTimeKind.Utc), EndDate = new DateTime(2026, 1, 18, 12, 0, 0, DateTimeKind.Utc), IsOpenForEnrollment = true },
                new WorkshopCycle { Id = 2104, WorkshopId = 2002, DisplayName = "Creative Writing – Oct 5 2025", StartDate = new DateTime(2025, 10, 5, 17, 0, 0, DateTimeKind.Utc), EndDate = new DateTime(2025, 10, 5, 20, 0, 0, DateTimeKind.Utc), IsOpenForEnrollment = false },
                new WorkshopCycle { Id = 2105, WorkshopId = 2002, DisplayName = "Creative Writing – Feb 10 2026", StartDate = new DateTime(2026, 2, 10, 17, 0, 0, DateTimeKind.Utc), EndDate = new DateTime(2026, 2, 10, 20, 0, 0, DateTimeKind.Utc), IsOpenForEnrollment = true },
                new WorkshopCycle { Id = 2106, WorkshopId = 2003, DisplayName = "4-Week Guitar Course – March 2026", StartDate = new DateTime(2026, 3, 4, 18, 0, 0, DateTimeKind.Utc), EndDate = new DateTime(2026, 3, 25, 20, 0, 0, DateTimeKind.Utc), IsOpenForEnrollment = true }
            );
            await db.SaveChangesAsync();
            logger?.LogInformation("Seeded WorkshopCycles table.");
        }

        // Sessions
        if (await TableExists("WorkshopSessions") && !db.WorkshopSessions.Any())
        {
            db.WorkshopSessions.AddRange(
                new WorkshopSession { Id = 2200, WorkshopCycleId = 2100, Topic = "Photography Basics – Core Session", StartTime = new DateTime(2025, 9, 10, 10, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2025, 9, 10, 13, 0, 0, DateTimeKind.Utc), AddressId = 52 },
                new WorkshopSession { Id = 2201, WorkshopCycleId = 2101, Topic = "Photography Basics – Core Session", StartTime = new DateTime(2025, 12, 15, 10, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2025, 12, 15, 13, 0, 0, DateTimeKind.Utc), AddressId = 52 },
                new WorkshopSession { Id = 2202, WorkshopCycleId = 2102, Topic = "Acrylic Painting – Techniques Session", StartTime = new DateTime(2025, 8, 20, 9, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2025, 8, 20, 12, 0, 0, DateTimeKind.Utc), AddressId = 55 },
                new WorkshopSession { Id = 2203, WorkshopCycleId = 2103, Topic = "Acrylic Painting – Techniques Session", StartTime = new DateTime(2026, 1, 18, 9, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2026, 1, 18, 12, 0, 0, DateTimeKind.Utc), AddressId = 55 },
                new WorkshopSession { Id = 2204, WorkshopCycleId = 2104, Topic = "Creative Writing – Narrative Fundamentals", StartTime = new DateTime(2025, 10, 5, 17, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2025, 10, 5, 20, 0, 0, DateTimeKind.Utc), AddressId = 51 },
                new WorkshopSession { Id = 2205, WorkshopCycleId = 2105, Topic = "Creative Writing – Narrative Fundamentals", StartTime = new DateTime(2026, 2, 10, 17, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2026, 2, 10, 20, 0, 0, DateTimeKind.Utc), AddressId = 51 },
                new WorkshopSession { Id = 2206, WorkshopCycleId = 2106, Topic = "Guitar Basics", StartTime = new DateTime(2026, 3, 4, 18, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2026, 3, 4, 20, 0, 0, DateTimeKind.Utc), AddressId = 50 },
                new WorkshopSession { Id = 2207, WorkshopCycleId = 2106, Topic = "Chords & Rhythm", StartTime = new DateTime(2026, 3, 11, 18, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2026, 3, 11, 20, 0, 0, DateTimeKind.Utc), AddressId = 50 },
                new WorkshopSession { Id = 2208, WorkshopCycleId = 2106, Topic = "Strumming Patterns & Dynamics", StartTime = new DateTime(2026, 3, 18, 18, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2026, 3, 18, 20, 0, 0, DateTimeKind.Utc), AddressId = 50 },
                new WorkshopSession { Id = 2209, WorkshopCycleId = 2106, Topic = "Song Playthrough & Review", StartTime = new DateTime(2026, 3, 25, 18, 0, 0, DateTimeKind.Utc), EndTime = new DateTime(2026, 3, 25, 20, 0, 0, DateTimeKind.Utc), AddressId = 50 }
            );
            await db.SaveChangesAsync();
            logger?.LogInformation("Seeded WorkshopSessions table.");
        }

        // Enrollments
        if (await TableExists("Enrollments") && !db.Enrollments.Any())
        {
            db.Enrollments.AddRange(
                new Enrollment { Id = 1000, UserId = 305, WorkshopCycleId = 2100, EnrolledAt = new DateTime(2025, 9, 1, 9, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1001, UserId = 306, WorkshopCycleId = 2100, EnrolledAt = new DateTime(2025, 9, 2, 10, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1002, UserId = 307, WorkshopCycleId = 2102, EnrolledAt = new DateTime(2025, 8, 10, 9, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1003, UserId = 308, WorkshopCycleId = 2102, EnrolledAt = new DateTime(2025, 8, 11, 9, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1004, UserId = 309, WorkshopCycleId = 2104, EnrolledAt = new DateTime(2025, 9, 20, 14, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1005, UserId = 310, WorkshopCycleId = 2101, EnrolledAt = new DateTime(2025, 10, 1, 10, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1006, UserId = 311, WorkshopCycleId = 2101, EnrolledAt = new DateTime(2025, 9, 28, 11, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1007, UserId = 312, WorkshopCycleId = 2103, EnrolledAt = new DateTime(2025, 9, 25, 12, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1008, UserId = 313, WorkshopCycleId = 2103, EnrolledAt = new DateTime(2025, 9, 26, 12, 30, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1009, UserId = 314, WorkshopCycleId = 2105, EnrolledAt = new DateTime(2025, 10, 5, 13, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1010, UserId = 315, WorkshopCycleId = 2105, EnrolledAt = new DateTime(2025, 9, 30, 13, 30, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1011, UserId = 316, WorkshopCycleId = 2106, EnrolledAt = new DateTime(2025, 9, 29, 14, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1012, UserId = 317, WorkshopCycleId = 2106, EnrolledAt = new DateTime(2025, 9, 27, 14, 30, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1013, UserId = 318, WorkshopCycleId = 2106, EnrolledAt = new DateTime(2025, 9, 24, 15, 0, 0, DateTimeKind.Utc), Status = "Active" },
                new Enrollment { Id = 1014, UserId = 319, WorkshopCycleId = 2106, EnrolledAt = new DateTime(2025, 9, 23, 15, 30, 0, DateTimeKind.Utc), Status = "Active" }
            );
            await db.SaveChangesAsync();
            logger?.LogInformation("Seeded Enrollments table.");
        }

        // Payments
        if (await TableExists("Payments") && !db.Payments.Any())
        {
            db.Payments.AddRange(
                new Payment { Id = 2000, EnrollmentId = 1000, Amount = 190m, Status = "Paid", Method = "BankTransfer", CreatedAt = new DateTime(2025, 9, 2, 9, 0, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 9, 9, 10, 0, 0, DateTimeKind.Utc) },
                new Payment { Id = 2001, EnrollmentId = 1001, Amount = 190m, Status = "Paid", Method = "Card", CreatedAt = new DateTime(2025, 9, 3, 10, 0, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 9, 9, 11, 0, 0, DateTimeKind.Utc) },
                new Payment { Id = 2002, EnrollmentId = 1002, Amount = 150m, Status = "Paid", Method = "Card", CreatedAt = new DateTime(2025, 8, 11, 9, 0, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 8, 19, 9, 0, 0, DateTimeKind.Utc) },
                new Payment { Id = 2003, EnrollmentId = 1003, Amount = 150m, Status = "Paid", Method = "BankTransfer", CreatedAt = new DateTime(2025, 8, 12, 9, 0, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 8, 19, 9, 30, 0, DateTimeKind.Utc) },
                new Payment { Id = 2004, EnrollmentId = 1004, Amount = 130m, Status = "Paid", Method = "Card", CreatedAt = new DateTime(2025, 9, 26, 14, 0, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 10, 4, 12, 0, 0, DateTimeKind.Utc) },
                new Payment { Id = 2005, EnrollmentId = 1005, Amount = 190m, Status = "Paid", Method = "Card", CreatedAt = new DateTime(2025, 10, 3, 10, 30, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 10, 3, 10, 35, 0, DateTimeKind.Utc) },
                new Payment { Id = 2006, EnrollmentId = 1006, Amount = 190m, Status = "Pending", Method = "BankTransfer", CreatedAt = new DateTime(2025, 10, 5, 11, 30, 0, DateTimeKind.Utc) },
                new Payment { Id = 2007, EnrollmentId = 1007, Amount = 150m, Status = "Paid", Method = "Card", CreatedAt = new DateTime(2025, 9, 27, 12, 30, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 9, 27, 12, 45, 0, DateTimeKind.Utc) },
                new Payment { Id = 2008, EnrollmentId = 1008, Amount = 150m, Status = "Pending", Method = "BankTransfer", CreatedAt = new DateTime(2025, 9, 28, 12, 40, 0, DateTimeKind.Utc) },
                new Payment { Id = 2009, EnrollmentId = 1009, Amount = 130m, Status = "Paid", Method = "Card", CreatedAt = new DateTime(2025, 10, 6, 13, 15, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 10, 6, 13, 20, 0, DateTimeKind.Utc) },
                new Payment { Id = 2010, EnrollmentId = 1010, Amount = 130m, Status = "Pending", Method = "BankTransfer", CreatedAt = new DateTime(2025, 10, 2, 13, 45, 0, DateTimeKind.Utc) },
                new Payment { Id = 2011, EnrollmentId = 1011, Amount = 480m, Status = "Paid", Method = "Card", CreatedAt = new DateTime(2025, 9, 30, 14, 10, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 9, 30, 14, 15, 0, DateTimeKind.Utc) },
                new Payment { Id = 2012, EnrollmentId = 1012, Amount = 480m, Status = "Pending", Method = "BankTransfer", CreatedAt = new DateTime(2025, 10, 4, 14, 45, 0, DateTimeKind.Utc) },
                new Payment { Id = 2013, EnrollmentId = 1013, Amount = 480m, Status = "Paid", Method = "Card", CreatedAt = new DateTime(2025, 9, 25, 15, 5, 0, DateTimeKind.Utc), PaidAt = new DateTime(2025, 9, 25, 15, 20, 0, DateTimeKind.Utc) },
                new Payment { Id = 2014, EnrollmentId = 1014, Amount = 480m, Status = "Pending", Method = "BankTransfer", CreatedAt = new DateTime(2025, 10, 7, 15, 40, 0, DateTimeKind.Utc) }
            );
            await db.SaveChangesAsync();
            logger?.LogInformation("Seeded Payments table.");
        }

        // Reviews
        if (await TableExists("Reviews") && !db.Reviews.Any())
        {
            db.Reviews.AddRange(
                new Review { Id = 3000, UserId = 305, WorkshopId = 2000, Rating = 5, Comment = "Excellent intro – very clear.", CreatedAt = new DateTime(2025, 9, 15, 12, 0, 0, DateTimeKind.Utc) },
                new Review { Id = 3001, UserId = 306, WorkshopId = 2000, Rating = 4, Comment = "Good pacing and helpful examples.", CreatedAt = new DateTime(2025, 9, 15, 12, 30, 0, DateTimeKind.Utc) },
                new Review { Id = 3002, UserId = 307, WorkshopId = 2001, Rating = 5, Comment = "Loved the techniques segment!", CreatedAt = new DateTime(2025, 8, 25, 11, 0, 0, DateTimeKind.Utc) },
                new Review { Id = 3003, UserId = 308, WorkshopId = 2001, Rating = 4, Comment = "Great instructor, learned a lot.", CreatedAt = new DateTime(2025, 8, 25, 11, 30, 0, DateTimeKind.Utc) },
                new Review { Id = 3004, UserId = 309, WorkshopId = 2002, Rating = 5, Comment = "Inspired to keep writing!", CreatedAt = new DateTime(2025, 10, 10, 19, 0, 0, DateTimeKind.Utc) }
            );
            await db.SaveChangesAsync();
            logger?.LogInformation("Seeded Reviews table.");
        }
        */
    }
    catch (Exception exSeedRuntime)
    {
        logger?.LogError(exSeedRuntime, "Runtime seeding is disabled; no demo data inserted at startup.");
    }

}

// If running in setup mode, exit after preparing DB
if (args.Contains("--setup-db") || Environment.GetEnvironmentVariable("SETUP_DB") == "1")
{
    Console.WriteLine("Setup mode detected: database created/seeded. Exiting.");
    return;
}

// Enable Swagger in all environments so students can test easily
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseCors("FrontendDev");
app.UseAuthentication();
app.UseAuthorization();

var webRoot = app.Environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
Directory.CreateDirectory(webRoot);
Directory.CreateDirectory(Path.Combine(webRoot, "uploads"));
Directory.CreateDirectory(Path.Combine(webRoot, "workshop-images"));

app.UseStaticFiles();

app.MapControllers();

app.Run();

public partial class Program { }

