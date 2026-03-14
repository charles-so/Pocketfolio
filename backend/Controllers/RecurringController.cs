using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
[Route("api/recurring")]
public class RecurringController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BudgetEngine _engine;

    public RecurringController(AppDbContext db, BudgetEngine engine)
    {
        _db = db;
        _engine = engine;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var entities = await _db.RecurringItems
            .Include(r => r.Envelope)
            .OrderBy(r => r.Type)
            .ThenBy(r => r.Id)
            .ToListAsync();

        var items = entities.Select(r =>
        {
            DateTime? next = null;
            if (r.Active)
            {
                next = r.LastAppliedDate == null
                    ? r.StartDate.Date
                    : NextDueDate(r.LastAppliedDate.Value, r.Frequency);
            }

            return new RecurringItemDto(
                r.Id,
                r.Type,
                r.Amount,
                r.Description,
                r.EnvelopeId,
                r.Envelope?.Name,
                r.Envelope?.GroupName,
                r.IncomeType,
                r.StartDate.ToString("yyyy-MM-dd"),
                r.Frequency,
                r.Active,
                r.LastAppliedDate?.ToString("yyyy-MM-dd"),
                next?.ToString("yyyy-MM-dd"));
        }).ToList();

        return Ok(new { items });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRecurringRequest req)
    {
        if (req.Amount <= 0)
            return BadRequest(new { error = "Amount must be positive." });

        var validTypes = new[] { "Income", "Expense" };
        if (!validTypes.Contains(req.Type))
            return BadRequest(new { error = "Type must be Income or Expense." });

        if (req.Type == "Expense" && !req.EnvelopeId.HasValue)
            return BadRequest(new { error = "Envelope is required for recurring expenses." });

        if (req.Type == "Income")
        {
            var validIncomeTypes = new[] { "Paycheck", "Bonus" };
            if (string.IsNullOrEmpty(req.IncomeType) || !validIncomeTypes.Contains(req.IncomeType))
                return BadRequest(new { error = "Income type must be Paycheck or Bonus." });
        }

        if (req.Type == "Expense" && req.EnvelopeId.HasValue)
        {
            var envExists = await _db.Envelopes.AnyAsync(e => e.Id == req.EnvelopeId.Value);
            if (!envExists)
                return BadRequest(new { error = "Envelope not found." });
        }

        if (!DateTime.TryParse(req.StartDate, out var startDate))
            return BadRequest(new { error = "Invalid start date." });

        var validFrequencies = new[] { "Fortnightly", "Monthly", "Quarterly", "Yearly" };
        if (string.IsNullOrEmpty(req.Frequency) || !validFrequencies.Contains(req.Frequency))
            return BadRequest(new { error = "Frequency must be Fortnightly, Monthly, Quarterly, or Yearly." });

        var item = new RecurringItem
        {
            Type = req.Type,
            Amount = Math.Round(req.Amount, 2),
            Description = req.Description?.Trim() ?? string.Empty,
            EnvelopeId = req.Type == "Expense" ? req.EnvelopeId : null,
            IncomeType = req.Type == "Income" ? req.IncomeType : null,
            StartDate = startDate.Date,
            Frequency = req.Frequency,
            Active = true,
            LastAppliedDate = null,
        };

        _db.RecurringItems.Add(item);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true, id = item.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRecurringRequest req)
    {
        var item = await _db.RecurringItems.FindAsync(id);
        if (item == null) return NotFound(new { error = "Recurring item not found." });

        if (req.Amount <= 0)
            return BadRequest(new { error = "Amount must be positive." });

        var validFrequencies = new[] { "Fortnightly", "Monthly", "Quarterly", "Yearly" };
        if (string.IsNullOrEmpty(req.Frequency) || !validFrequencies.Contains(req.Frequency))
            return BadRequest(new { error = "Frequency must be Fortnightly, Monthly, Quarterly, or Yearly." });

        if (item.Type == "Expense" && !req.EnvelopeId.HasValue)
            return BadRequest(new { error = "Envelope is required for recurring expenses." });

        if (item.Type == "Expense" && req.EnvelopeId.HasValue)
        {
            var envExists = await _db.Envelopes.AnyAsync(e => e.Id == req.EnvelopeId.Value);
            if (!envExists)
                return BadRequest(new { error = "Envelope not found." });
        }

        if (item.Type == "Income")
        {
            var validIncomeTypes = new[] { "Paycheck", "Bonus" };
            if (string.IsNullOrEmpty(req.IncomeType) || !validIncomeTypes.Contains(req.IncomeType))
                return BadRequest(new { error = "Income type must be Paycheck or Bonus." });
            item.IncomeType = req.IncomeType;
        }
        else
        {
            item.EnvelopeId = req.EnvelopeId;
        }

        item.Amount = Math.Round(req.Amount, 2);
        item.Description = req.Description?.Trim() ?? string.Empty;
        item.Frequency = req.Frequency;

        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPut("{id}/toggle")]
    public async Task<IActionResult> Toggle(int id)
    {
        var item = await _db.RecurringItems.FindAsync(id);
        if (item == null) return NotFound(new { error = "Recurring item not found." });

        item.Active = !item.Active;
        await _db.SaveChangesAsync();

        return Ok(new { ok = true, active = item.Active });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.RecurringItems.FindAsync(id);
        if (item == null) return NotFound(new { error = "Recurring item not found." });

        _db.RecurringItems.Remove(item);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    [HttpPost("apply")]
    public async Task<IActionResult> ApplyNow()
    {
        var applied = await ApplyRecurringItems(DateTime.Today);
        return Ok(new { ok = true, applied });
    }

    // ── Pending / Confirm / Skip endpoints ──

    [HttpGet("pending")]
    public async Task<IActionResult> GetPending()
    {
        var pending = await GetPendingItems(DateTime.Today);
        return Ok(new { items = pending });
    }

    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm([FromBody] ConfirmRecurringRequest req)
    {
        if (!DateTime.TryParse(req.DueDate, out var dueDate))
            return BadRequest(new { error = "Invalid due date." });

        var item = await _db.RecurringItems
            .Include(r => r.Envelope)
            .FirstOrDefaultAsync(r => r.Id == req.RecurringItemId);
        if (item == null)
            return NotFound(new { error = "Recurring item not found." });

        if (item.Type == "Income")
        {
            _db.Incomes.Add(new Income
            {
                Amount = item.Amount,
                Date = dueDate.Date,
                Type = item.IncomeType ?? "Paycheck",
                Description = item.Description,
                RecurringItemId = item.Id,
            });
        }
        else if (item.Type == "Expense" && item.EnvelopeId.HasValue)
        {
            _db.Transactions.Add(new Transaction
            {
                EnvelopeId = item.EnvelopeId.Value,
                Amount = item.Amount,
                Date = dueDate.Date,
                Description = item.Description,
                RecurringItemId = item.Id,
            });
        }

        if (!item.LastAppliedDate.HasValue || dueDate.Date >= item.LastAppliedDate.Value)
            item.LastAppliedDate = dueDate.Date;

        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPost("skip")]
    public async Task<IActionResult> Skip([FromBody] ConfirmRecurringRequest req)
    {
        if (!DateTime.TryParse(req.DueDate, out var dueDate))
            return BadRequest(new { error = "Invalid due date." });

        var item = await _db.RecurringItems.FindAsync(req.RecurringItemId);
        if (item == null)
            return NotFound(new { error = "Recurring item not found." });

        if (!item.LastAppliedDate.HasValue || dueDate.Date >= item.LastAppliedDate.Value)
            item.LastAppliedDate = dueDate.Date;

        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpPost("confirm-all")]
    public async Task<IActionResult> ConfirmAll()
    {
        var applied = await ApplyRecurringItems(DateTime.Today);
        return Ok(new { ok = true, applied });
    }

    // ── Internal methods ──

    /// <summary>
    /// Get all pending recurring items up to the given date without creating records.
    /// </summary>
    private async Task<List<PendingRecurringItemDto>> GetPendingItems(DateTime upToDate)
    {
        var activeItems = await _db.RecurringItems
            .Include(r => r.Envelope)
            .Where(r => r.Active)
            .ToListAsync();

        var pending = new List<PendingRecurringItemDto>();

        foreach (var item in activeItems)
        {
            DateTime nextDate;
            if (item.LastAppliedDate == null)
                nextDate = item.StartDate.Date;
            else
                nextDate = NextDueDate(item.LastAppliedDate.Value, item.Frequency);

            while (nextDate <= upToDate)
            {
                pending.Add(new PendingRecurringItemDto(
                    item.Id,
                    item.Type,
                    item.Amount,
                    item.Description,
                    item.EnvelopeId,
                    item.Envelope?.Name,
                    item.IncomeType,
                    nextDate.ToString("yyyy-MM-dd"),
                    item.Frequency
                ));

                nextDate = NextDueDate(nextDate, item.Frequency);
            }
        }

        return pending;
    }

    /// <summary>
    /// Apply all active recurring items up to the given date.
    /// Returns the count of records created.
    /// </summary>
    public async Task<int> ApplyRecurringItems(DateTime upToDate)
    {
        var activeItems = await _db.RecurringItems
            .Where(r => r.Active)
            .ToListAsync();

        int created = 0;

        foreach (var item in activeItems)
        {
            DateTime nextDate;
            if (item.LastAppliedDate == null)
            {
                nextDate = item.StartDate.Date;
            }
            else
            {
                nextDate = NextDueDate(item.LastAppliedDate.Value, item.Frequency);
            }

            if (nextDate > upToDate) continue;

            DateTime lastGenerated = nextDate;

            while (nextDate <= upToDate)
            {
                lastGenerated = nextDate;

                if (item.Type == "Income")
                {
                    _db.Incomes.Add(new Income
                    {
                        Amount = item.Amount,
                        Date = nextDate,
                        Type = item.IncomeType ?? "Paycheck",
                        Description = item.Description,
                        RecurringItemId = item.Id,
                    });
                    created++;
                }
                else if (item.Type == "Expense" && item.EnvelopeId.HasValue)
                {
                    _db.Transactions.Add(new Transaction
                    {
                        EnvelopeId = item.EnvelopeId.Value,
                        Amount = item.Amount,
                        Date = nextDate,
                        Description = item.Description,
                        RecurringItemId = item.Id,
                    });
                    created++;
                }

                nextDate = NextDueDate(nextDate, item.Frequency);
            }

            item.LastAppliedDate = lastGenerated;
        }

        if (created > 0)
            await _db.SaveChangesAsync();

        return created;
    }

    /// <summary>
    /// Calculate the next due date based on frequency.
    /// </summary>
    private static DateTime NextDueDate(DateTime current, string frequency)
    {
        return frequency switch
        {
            "Monthly" => current.AddMonths(1),
            "Quarterly" => current.AddMonths(3),
            "Yearly" => current.AddYears(1),
            _ => current.AddDays(14), // Fortnightly (default)
        };
    }
}
