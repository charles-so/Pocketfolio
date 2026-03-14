using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BlobStorageService _blob;

    public AdminController(AppDbContext db, BlobStorageService blob)
    {
        _db = db;
        _blob = blob;
    }

    [HttpGet("users")]
    public async Task<IActionResult> ListUsers()
    {
        var users = await _db.Users
            .OrderBy(u => u.Id)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.IsAdmin,
                u.CreatedAt,
                EnvelopeCount = _db.Envelopes.IgnoreQueryFilters().Count(e => e.UserId == u.Id),
                TransactionCount = _db.Transactions.IgnoreQueryFilters().Count(t => t.UserId == u.Id),
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUser(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound(new { error = "User not found." });

        var envelopeCount = await _db.Envelopes.IgnoreQueryFilters().CountAsync(e => e.UserId == id);
        var transactionCount = await _db.Transactions.IgnoreQueryFilters().CountAsync(t => t.UserId == id);
        var incomeCount = await _db.Incomes.IgnoreQueryFilters().CountAsync(i => i.UserId == id);
        var holdingCount = await _db.PortfolioHoldings.IgnoreQueryFilters().CountAsync(h => h.UserId == id);
        var tradeCount = await _db.Trades.IgnoreQueryFilters().CountAsync(t => t.UserId == id);

        return Ok(new
        {
            user.Id,
            user.Username,
            user.IsAdmin,
            user.CreatedAt,
            Stats = new
            {
                Envelopes = envelopeCount,
                Transactions = transactionCount,
                Incomes = incomeCount,
                Holdings = holdingCount,
                Trades = tradeCount,
            }
        });
    }

    [HttpPost("users/{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] AdminResetPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
            return BadRequest(new { error = "Password must be at least 6 characters." });

        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound(new { error = "User not found." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();

        return Ok(new { message = "Password reset for " + user.Username });
    }

    [HttpPost("users/{id}/toggle-admin")]
    public async Task<IActionResult> ToggleAdmin(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound(new { error = "User not found." });

        var currentUserId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
        if (user.Id == currentUserId && user.IsAdmin)
            return BadRequest(new { error = "You cannot remove your own admin role." });

        user.IsAdmin = !user.IsAdmin;
        await _db.SaveChangesAsync();

        return Ok(new { message = user.IsAdmin ? user.Username + " is now an admin" : user.Username + " is no longer an admin", isAdmin = user.IsAdmin });
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound(new { error = "User not found." });

        var currentUserId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
        if (user.Id == currentUserId)
            return BadRequest(new { error = "You cannot delete your own account." });

        // Delete blob files first
        var userAttachments = await _db.Attachments.IgnoreQueryFilters().Where(x => x.UserId == id).ToListAsync();
        foreach (var att in userAttachments)
            await _blob.DeleteAsync(att.BlobName);
        _db.Attachments.RemoveRange(userAttachments);
        await _db.BonusAllocations.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.Trades.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.Transactions.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.BudgetChanges.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.RecurringItems.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.Incomes.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.PortfolioHoldings.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.Envelopes.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.Settings.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.WatchlistItems.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        await _db.TickerDirectory.IgnoreQueryFilters().Where(x => x.UserId == id).ExecuteDeleteAsync();
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        return Ok(new { message = "User " + user.Username + " deleted." });
    }
}

public record AdminResetPasswordRequest(string NewPassword);
