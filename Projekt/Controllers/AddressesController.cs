using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Projekt.Data;
using Projekt.Models;
using System.Security.Claims;
using System.Data.Common;

namespace Projekt.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AddressesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly Projekt.Services.IAuditLogger _audit;

        public AddressesController(AppDbContext context, Projekt.Services.IAuditLogger audit)
        {
            _context = context;
            _audit = audit;
        }

        // get addresses
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<Address>>> GetAddresses()
        {
            var addresses = await _context.Addresses.AsNoTracking().ToListAsync();
            return Ok(addresses);
        }

        // get address
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<Address>> GetAddress(int id)
        {
            var address = await _context.Addresses.FindAsync(id);
            if (address == null) return NotFound();
            return Ok(address);
        }

        public class AddressCreateDto
        {
            public required string City { get; set; }
            public required string Street { get; set; }
            public required string BuildingNumber { get; set; }
            public string? Room { get; set; }
            public string? AdditionalInfo { get; set; }
        }

        // create address
        [HttpPost]
        public async Task<ActionResult<Address>> CreateAddress([FromBody] AddressCreateDto dto)
        {
            try
            {
                if (!ModelState.IsValid) return BadRequest(ModelState);
                if (string.IsNullOrWhiteSpace(dto.City) || string.IsNullOrWhiteSpace(dto.Street) || string.IsNullOrWhiteSpace(dto.BuildingNumber))
                    return BadRequest("City, Street and BuildingNumber are required.");

                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                try
                {
                    await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "INSERT INTO dbo.Addresses (City,Street,BuildingNumber,Room,AdditionalInfo) VALUES (@c,@s,@b,@r,@a); SELECT CAST(SCOPE_IDENTITY() AS int);";
                    var pC = cmd.CreateParameter(); pC.ParameterName = "@c"; pC.Value = dto.City.Trim(); cmd.Parameters.Add(pC);
                    var pS = cmd.CreateParameter(); pS.ParameterName = "@s"; pS.Value = dto.Street.Trim(); cmd.Parameters.Add(pS);
                    var pB = cmd.CreateParameter(); pB.ParameterName = "@b"; pB.Value = dto.BuildingNumber.Trim(); cmd.Parameters.Add(pB);
                    var pR = cmd.CreateParameter(); pR.ParameterName = "@r"; pR.Value = (object?) (string.IsNullOrWhiteSpace(dto.Room) ? null : dto.Room.Trim()) ?? DBNull.Value; cmd.Parameters.Add(pR);
                    var pA = cmd.CreateParameter(); pA.ParameterName = "@a"; pA.Value = (object?) (string.IsNullOrWhiteSpace(dto.AdditionalInfo) ? null : dto.AdditionalInfo.Trim()) ?? DBNull.Value; cmd.Parameters.Add(pA);
                    var newId = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                    var created = new Address { Id = newId, City = dto.City.Trim(), Street = dto.Street.Trim(), BuildingNumber = dto.BuildingNumber.Trim(), Room = string.IsNullOrWhiteSpace(dto.Room)? null : dto.Room.Trim(), AdditionalInfo = string.IsNullOrWhiteSpace(dto.AdditionalInfo)? null : dto.AdditionalInfo.Trim() };
                    
                    // LOG: Address created
                    await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ADDRESS_CREATED, 
                        $"Address ID={newId} created: {created.City}, {created.Street} {created.BuildingNumber}{(string.IsNullOrWhiteSpace(created.Room) ? "" : $", room {created.Room}")}");
                    
                    return CreatedAtAction(nameof(GetAddress), new { id = created.Id }, created);
                }
                finally { try { await conn.CloseAsync(); } catch { } }
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to create address: {ex.Message}");
                return StatusCode(500, new { error = "Failed to create address", detail = ex.Message });
            }
        }

        public class AddressUpdateDto : AddressCreateDto { public int Id { get; set; } }

        // update address
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAddress(int id, [FromBody] AddressUpdateDto dto)
        {
            if (id != dto.Id) return BadRequest("Ids do not match");
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                try
                {
                    await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "UPDATE dbo.Addresses SET City=@c, Street=@s, BuildingNumber=@b, Room=@r, AdditionalInfo=@a WHERE Id=@id";
                    var pID = cmd.CreateParameter(); pID.ParameterName = "@id"; pID.Value = id; cmd.Parameters.Add(pID);
                    var pC = cmd.CreateParameter(); pC.ParameterName = "@c"; pC.Value = dto.City.Trim(); cmd.Parameters.Add(pC);
                    var pS = cmd.CreateParameter(); pS.ParameterName = "@s"; pS.Value = dto.Street.Trim(); cmd.Parameters.Add(pS);
                    var pB = cmd.CreateParameter(); pB.ParameterName = "@b"; pB.Value = dto.BuildingNumber.Trim(); cmd.Parameters.Add(pB);
                    var pR = cmd.CreateParameter(); pR.ParameterName = "@r"; pR.Value = (object?) (string.IsNullOrWhiteSpace(dto.Room) ? null : dto.Room.Trim()) ?? DBNull.Value; cmd.Parameters.Add(pR);
                    var pA = cmd.CreateParameter(); pA.ParameterName = "@a"; pA.Value = (object?) (string.IsNullOrWhiteSpace(dto.AdditionalInfo) ? null : dto.AdditionalInfo.Trim()) ?? DBNull.Value; cmd.Parameters.Add(pA);
                    var affected = await cmd.ExecuteNonQueryAsync();
                    if (affected == 0) return NotFound();
                    
                    // LOG: Address updated
                    await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ADDRESS_UPDATED, 
                        $"Address ID={id} updated: {dto.City}, {dto.Street} {dto.BuildingNumber}{(string.IsNullOrWhiteSpace(dto.Room) ? "" : $", room {dto.Room}")}");
                    
                    return NoContent();
                }
                finally { try { await conn.CloseAsync(); } catch { } }
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to update address ID={id}: {ex.Message}");
                return StatusCode(500, new { error = "Failed to update address", detail = ex.Message });
            }
        }

        // delete address
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAddress(int id)
        {
            // Get address info before deletion for logging
            Address? addressToDelete = null;
            try
            {
                addressToDelete = await _context.Addresses.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
            }
            catch { }

            try
            {
                var conn = _context.Database.GetDbConnection();
                await conn.OpenAsync();
                try
                {
                    await Projekt.Services.SessionContextHelper.SetAppUserIdAsync(conn, User);
                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "DELETE FROM dbo.Addresses WHERE Id=@id";
                    var p = cmd.CreateParameter(); p.ParameterName = "@id"; p.Value = id; cmd.Parameters.Add(p);
                    var affected = await cmd.ExecuteNonQueryAsync();
                    if (affected == 0) return NotFound();
                    
                    // LOG: Address deleted
                    var addressDesc = addressToDelete != null 
                        ? $"{addressToDelete.City}, {addressToDelete.Street} {addressToDelete.BuildingNumber}" 
                        : $"ID={id}";
                    await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ADDRESS_DELETED, 
                        $"Address {addressDesc} deleted");
                    
                    return NoContent();
                }
                finally { try { await conn.CloseAsync(); } catch { } }
            }
            catch (DbUpdateException dbEx)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to delete address ID={id} (FK constraint): {dbEx.Message}");
                return StatusCode(500, new { error = "Failed to delete address", detail = dbEx.Message });
            }
            catch (Exception ex)
            {
                await _audit.LogForHttpAsync(HttpContext, Projekt.Services.AuditActions.ERROR_DATABASE, 
                    $"Failed to delete address ID={id}: {ex.Message}");
                return StatusCode(500, new { error = "Failed to delete address", detail = ex.Message });
            }
        }
    }
}
