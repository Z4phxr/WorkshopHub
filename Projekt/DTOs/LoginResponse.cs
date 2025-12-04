namespace Projekt.DTOs
{
    public class LoginResponse
    {
        public required string Token { get; set; }
        public required string Email { get; set; }
        public required IEnumerable<string> Roles { get; set; }
    }
}
