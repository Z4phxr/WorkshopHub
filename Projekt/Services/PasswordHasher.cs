using System;
using System.Security.Cryptography;
using System.Text;

namespace Projekt.Services
{
    public static class PasswordHasher
    {
        // simple
        private const int SaltSize = 16;
        private const int KeySize = 32;
        private const int DefaultIterations = 100_000;
        private static readonly HashAlgorithmName DefaultAlgorithm = HashAlgorithmName.SHA256;
        private static readonly HashAlgorithmName[] FallbackAlgorithms = new[]
        {
            HashAlgorithmName.SHA256,
            HashAlgorithmName.SHA512,
            HashAlgorithmName.SHA1
        };

        // make hash
        public static string Hash(string password, int iterations = DefaultIterations)
        {
            if (password == null) throw new ArgumentNullException(nameof(password));

            Span<byte> salt = stackalloc byte[SaltSize];
            RandomNumberGenerator.Fill(salt);

            var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, DefaultAlgorithm, KeySize);

            return $"PBKDF2${iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
        }

        // check hash
        public static bool Verify(string storedHash, string password)
        {
            if (string.IsNullOrWhiteSpace(storedHash) || password == null)
                return false;

            storedHash = storedHash.Trim();

            if (!storedHash.Contains('$'))
            {
                return CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(storedHash),
                    Encoding.UTF8.GetBytes(password));
            }

            var parts = storedHash.Split('$', StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length == 4 && parts[0] == "PBKDF2")
            {
                if (!int.TryParse(parts[1], out var iterations))
                    return false;
                if (!TryBase64(parts[2], out var salt) || !TryBase64(parts[3], out var expected))
                    return false;

                foreach (var algo in FallbackAlgorithms)
                {
                    var computed = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, algo, expected.Length);
                    if (CryptographicOperations.FixedTimeEquals(computed, expected))
                        return true;
                }
                return false;
            }

            if (parts.Length == 5 && parts[0] == "PBKDF2")
            {
                var algoName = parts[1].ToUpperInvariant();
                if (!int.TryParse(parts[2], out var iterations))
                    return false;
                if (!TryBase64(parts[3], out var salt) || !TryBase64(parts[4], out var expected))
                    return false;

                HashAlgorithmName algo = algoName switch
                {
                    "SHA256" => HashAlgorithmName.SHA256,
                    "SHA512" => HashAlgorithmName.SHA512,
                    "SHA1" => HashAlgorithmName.SHA1,
                    _ => DefaultAlgorithm
                };

                var computed = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, algo, expected.Length);
                return CryptographicOperations.FixedTimeEquals(computed, expected);
            }

            return false;
        }

        // tiny helper
        private static bool TryBase64(string s, out byte[] bytes)
        {
            try
            {
                bytes = Convert.FromBase64String(s);
                return true;
            }
            catch
            {
                bytes = Array.Empty<byte>();
                return false;
            }
        }
    }
}
