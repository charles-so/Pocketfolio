using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Entities;

namespace Pocketfolio.Api.Controllers;

[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || req.Username.Trim().Length < 3)
            return BadRequest(new { error = "Username must be at least 3 characters." });
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return BadRequest(new { error = "Password must be at least 6 characters." });

        var username = req.Username.Trim().ToLower();
        if (await _db.Users.AnyAsync(u => u.Username == username))
            return BadRequest(new { error = "This username is already taken." });

        var user = new User
        {
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // Seed default data for the new user
        _db.UserId = user.Id;
        await SeedData.InitializeAsync(_db);

        var token = GenerateToken(user);
        return Ok(new AuthResponse(token, user.Username, user.IsAdmin));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Username and password are required." });

        var username = req.Username.Trim().ToLower();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid username or password." });

        var token = GenerateToken(user);
        return Ok(new AuthResponse(token, user.Username, user.IsAdmin));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return Unauthorized();

        return Ok(new { username = user.Username, isAdmin = user.IsAdmin, createdAt = user.CreatedAt });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.CurrentPassword))
            return BadRequest(new { error = "Current password is required." });
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
            return BadRequest(new { error = "New password must be at least 6 characters." });

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return Unauthorized();

        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
            return BadRequest(new { error = "Current password is incorrect." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password changed successfully." });
    }

    private string GenerateToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
        };

        if (user.IsAdmin)
            claims.Add(new Claim(ClaimTypes.Role, "Admin"));

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Issuer"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(
                double.Parse(_config["Jwt:ExpiresHours"] ?? "168")),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [HttpPost("master-reset-password")]
    public async Task<IActionResult> MasterResetPassword([FromBody] MasterResetPasswordRequest req)
    {
        var configKey = _config["MasterKey"];
        if (string.IsNullOrEmpty(configKey) || req.MasterKey != configKey)
            return Unauthorized(new { error = "Invalid master key." });

        if (string.IsNullOrWhiteSpace(req.Username))
            return BadRequest(new { error = "Username is required." });
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
            return BadRequest(new { error = "New password must be at least 6 characters." });

        var username = req.Username.Trim().ToLower();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null)
            return NotFound(new { error = "User not found." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password reset successfully for " + username });
    }
}
