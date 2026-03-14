using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
public class TransactionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BudgetEngine _engine;

    public TransactionsController(AppDbContext db, BudgetEngine engine)
    {
        _db = db;
        _engine = engine;
    }

    [HttpGet("api/transactions")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? envelope_id,
        [FromQuery] string? group_name,
        [FromQuery] int? recurring_item_id,
        [FromQuery] string? date_from,
        [FromQuery] string? date_to,
        [FromQuery] int limit = 50)
    {
        var query = _db.Transactions
            .Include(t => t.Envelope)
            .AsQueryable();

        if (envelope_id.HasValue)
            query = query.Where(t => t.EnvelopeId == envelope_id.Value);
        if (recurring_item_id.HasValue)
            query = query.Where(t => t.RecurringItemId == recurring_item_id.Value);
        if (!string.IsNullOrEmpty(date_from) && DateTime.TryParse(date_from, out var df))
            query = query.Where(t => t.Date >= df);
        if (!string.IsNullOrEmpty(date_to) && DateTime.TryParse(date_to, out var dt))
            query = query.Where(t => t.Date <= dt);

        var txns = await query
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.Id)
            .Select(t => new TransactionDto
            {
                Id = t.Id,
                EnvelopeId = t.EnvelopeId,
                Amount = t.Amount,
                Date = t.Date.ToString("yyyy-MM-dd"),
                Description = t.Description,
                CreatedAt = t.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                EnvelopeName = t.Envelope.Name,
                GroupName = t.Envelope.GroupName,
                RowType = "txn",
            })
            .ToListAsync();

        // Merge bonus allocations (skip when filtering by recurring item)
        var bonusQuery = _db.BonusAllocations
            .Include(b => b.Envelope)
            .AsQueryable();

        if (recurring_item_id.HasValue)
            bonusQuery = bonusQuery.Where(b => false); // no bonuses from recurring items
        else if (envelope_id.HasValue)
            bonusQuery = bonusQuery.Where(b => b.EnvelopeId == envelope_id.Value);

        var bonuses = await bonusQuery
            .OrderByDescending(b => b.Period)
            .ThenByDescending(b => b.Id)
            .ToListAsync();

        var cycleStart = _engine.CycleStart;
        foreach (var b in bonuses)
        {
            var pStart = cycleStart.AddDays((b.Period - 1) * 14);
            var pEnd = pStart.AddDays(13);
            var dateStr = pStart.ToString("yyyy-MM-dd");

            if (!string.IsNullOrEmpty(date_from) && string.Compare(dateStr, date_from) < 0) continue;
            if (!string.IsNullOrEmpty(date_to) && string.Compare(dateStr, date_to) > 0) continue;

            txns.Add(new TransactionDto
            {
                Id = b.Id,
                EnvelopeId = b.EnvelopeId,
                Amount = b.Amount,
                Date = dateStr,
                Description = b.Description,
                CreatedAt = b.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                EnvelopeName = b.Envelope.Name,
                GroupName = b.Envelope.GroupName,
                RowType = "bonus",
                Period = b.Period,
                PeriodLabel = $"Period {b.Period}: {pStart:dd MMM} \u2013 {pEnd:dd MMM yyyy}",
            });
        }

        // Merge income records (when not filtering by envelope, or filtering by recurring item)
        if ((!envelope_id.HasValue && string.IsNullOrEmpty(group_name)) || recurring_item_id.HasValue)
        {
            var incomeQuery = _db.Incomes.AsQueryable();

            if (recurring_item_id.HasValue)
                incomeQuery = incomeQuery.Where(i => i.RecurringItemId == recurring_item_id.Value);
            if (!string.IsNullOrEmpty(date_from) && DateTime.TryParse(date_from, out var idf))
                incomeQuery = incomeQuery.Where(i => i.Date >= idf);
            if (!string.IsNullOrEmpty(date_to) && DateTime.TryParse(date_to, out var idt))
                incomeQuery = incomeQuery.Where(i => i.Date <= idt);

            var incomes = await incomeQuery
                .OrderByDescending(i => i.Date)
                .ThenByDescending(i => i.Id)
                .ToListAsync();

            foreach (var inc in incomes)
            {
                var typeLabel = inc.Type switch
                {
                    "Paycheck" => "Paycheck",
                    "StockSale" => "Stock Sale",
                    "Bonus" => "Bonus",
                    _ => inc.Type,
                };

                txns.Add(new TransactionDto
                {
                    Id = inc.Id,
                    EnvelopeId = 0,
                    Amount = inc.Amount,
                    Date = inc.Date.ToString("yyyy-MM-dd"),
                    Description = inc.Description,
                    CreatedAt = inc.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
                    EnvelopeName = typeLabel,
                    GroupName = "Income",
                    RowType = "income",
                });
            }
        }

        // Mark all existing records as committed
        foreach (var t in txns) t.Status = "committed";

        // Add pending items when filtering by recurring item
        if (recurring_item_id.HasValue)
        {
            var recItem = await _db.RecurringItems
                .Include(r => r.Envelope)
                .FirstOrDefaultAsync(r => r.Id == recurring_item_id.Value);

            if (recItem != null && recItem.Active)
            {
                DateTime nextDate = recItem.LastAppliedDate == null
                    ? recItem.StartDate.Date
                    : NextRecurringDate(recItem.LastAppliedDate.Value, recItem.Frequency);

                // Show pending items (due today or earlier) + next scheduled item
                var today = DateTime.Today;
                bool addedScheduled = false;
                while (true)
                {
                    var isDue = nextDate <= today;
                    if (!isDue && addedScheduled) break;

                    var status = isDue ? "pending" : "scheduled";
                    var dateStr = nextDate.ToString("yyyy-MM-dd");
                    if (recItem.Type == "Income")
                    {
                        var typeLabel = recItem.IncomeType switch
                        {
                            "Paycheck" => "Paycheck",
                            "StockSale" => "Stock Sale",
                            "Bonus" => "Bonus",
                            _ => recItem.IncomeType ?? "Paycheck",
                        };
                        txns.Add(new TransactionDto
                        {
                            Id = 0,
                            EnvelopeId = 0,
                            Amount = recItem.Amount,
                            Date = dateStr,
                            Description = recItem.Description,
                            EnvelopeName = typeLabel,
                            GroupName = "Income",
                            RowType = "income",
                            Status = status,
                        });
                    }
                    else if (recItem.Type == "Expense" && recItem.Envelope != null)
                    {
                        txns.Add(new TransactionDto
                        {
                            Id = 0,
                            EnvelopeId = recItem.EnvelopeId ?? 0,
                            Amount = recItem.Amount,
                            Date = dateStr,
                            Description = recItem.Description,
                            EnvelopeName = recItem.Envelope.Name,
                            GroupName = recItem.Envelope.GroupName,
                            RowType = "txn",
                            Status = status,
                        });
                    }
                    if (!isDue) addedScheduled = true;
                    nextDate = NextRecurringDate(nextDate, recItem.Frequency);
                }
            }
        }

        // Sort combined list by date descending
        txns.Sort((a, b) => string.Compare(b.Date, a.Date, StringComparison.Ordinal));

        // Load attachment info for all row types
        var attachInfoAll = await _db.Attachments
            .GroupBy(a => new { a.EntityType, a.EntityId })
            .Select(g => new { g.Key.EntityType, g.Key.EntityId, Count = g.Count(), FirstName = g.OrderBy(a => a.Id).First().FileName })
            .ToListAsync();
        var attachLookup = attachInfoAll.ToDictionary(a => (a.EntityType, a.EntityId));
        foreach (var t in txns)
        {
            if (attachLookup.TryGetValue((t.RowType, t.Id), out var info))
            {
                t.AttachmentCount = info.Count;
                t.AttachmentName = info.FirstName;
            }
        }
        var totalCount = txns.Count;
        var shown = txns.Take(limit).ToList();

        // Get envelopes for filter dropdown (exclude Unallocated)
        var groups = await _db.Envelopes
            .Where(e => e.Name != "Unallocated")
            .Select(e => e.GroupName)
            .Distinct()
            .OrderBy(g => g)
            .ToListAsync();

        var envelopes = await _db.Envelopes
            .Where(e => e.Name != "Unallocated")
            .OrderBy(e => e.SortOrder)
            .ThenBy(e => e.Name)
            .Select(e => new { e.Id, e.Name, e.GroupName })
            .ToListAsync();

        var (currentPeriod, _, _) = _engine.PeriodForDate(DateTime.Today);
        currentPeriod = Math.Max(currentPeriod, 1);

        return Ok(new
        {
            transactions = shown,
            envelopes,
            groups,
            totalCount,
            shownCount = shown.Count,
            currentPeriod,
            cycleStart = cycleStart.ToString("yyyy-MM-dd"),
        });
    }

    [HttpPost("api/transactions")]
    public IActionResult Create([FromBody] CreateTransactionRequest req)
    {
        if (!DateTime.TryParse(req.Date, out var txnDate))
            return BadRequest(new { error = "Invalid date. Use YYYY-MM-DD." });

        if (txnDate < _engine.CycleStart)
            return BadRequest(new { error = $"Date cannot be before pay cycle start ({_engine.CycleStart:yyyy-MM-dd})." });

        if (req.Amount == 0)
            return BadRequest(new { error = "Enter a non-zero dollar amount." });

        var txn = new Transaction
        {
            EnvelopeId = req.EnvelopeId,
            Amount = req.Amount,
            Date = txnDate,
            Description = req.Description?.Trim() ?? "",
        };
        _db.Transactions.Add(txn);
        _db.SaveChanges();

        return Ok(new { ok = true, id = txn.Id });
    }

    [HttpPut("api/transactions/{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTransactionRequest req)
    {
        if (!DateTime.TryParse(req.Date, out var txnDate))
            return BadRequest(new { error = "Invalid date. Use YYYY-MM-DD." });

        if (txnDate < _engine.CycleStart)
            return BadRequest(new { error = $"Date cannot be before pay cycle start ({_engine.CycleStart:yyyy-MM-dd})." });

        if (req.Amount == 0)
            return BadRequest(new { error = "Enter a non-zero dollar amount." });

        var txn = await _db.Transactions.FindAsync(id);
        if (txn == null) return NotFound(new { error = "Transaction not found." });

        // Guard: prevent reducing an investment deposit if it would make cash to invest negative
        var envelope = await _db.Envelopes.FindAsync(txn.EnvelopeId);
        if (envelope != null && !string.IsNullOrEmpty(envelope.Ticker) && req.Amount < txn.Amount)
        {
            var reduction = txn.Amount - req.Amount;
            var cashAfter = _engine.GetInvestmentCash(txn.EnvelopeId) - reduction;
            if (cashAfter < 0)
                return BadRequest(new { error = "Cannot reduce this deposit below your traded amount. Sell holdings first." });
        }

        txn.EnvelopeId = req.EnvelopeId;
        txn.Amount = req.Amount;
        txn.Date = txnDate;
        txn.Description = req.Description?.Trim() ?? "";
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    [HttpDelete("api/transactions/{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var txn = await _db.Transactions.FindAsync(id);
        if (txn == null) return NotFound(new { error = "Transaction not found." });

        // Guard: prevent deleting an investment deposit if it would make cash to invest negative
        var envelope = await _db.Envelopes.FindAsync(txn.EnvelopeId);
        if (envelope != null && !string.IsNullOrEmpty(envelope.Ticker))
        {
            var cashAfter = _engine.GetInvestmentCash(txn.EnvelopeId) - txn.Amount;
            if (cashAfter < 0)
                return BadRequest(new { error = "Cannot delete this deposit — you have trades that depend on it. Sell your holdings first." });
        }

        _db.Transactions.Remove(txn);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    private static DateTime NextRecurringDate(DateTime current, string frequency)
    {
        return frequency switch
        {
            "Monthly" => current.AddMonths(1),
            "Quarterly" => current.AddMonths(3),
            "Yearly" => current.AddYears(1),
            _ => current.AddDays(14), // Fortnightly
        };
    }

    // Bonus endpoints
    [HttpPost("api/bonus")]
    public IActionResult CreateBonus([FromBody] CreateBonusRequest req)
    {
        if (req.Amount <= 0)
            return BadRequest(new { error = "Enter a positive dollar amount." });
        if (req.Period < 1)
            return BadRequest(new { error = "Invalid period." });

        _db.BonusAllocations.Add(new BonusAllocation
        {
            EnvelopeId = req.EnvelopeId,
            Amount = req.Amount,
            Period = req.Period,
            Description = req.Description?.Trim() ?? "",
        });
        _db.SaveChanges();

        return Ok(new { ok = true });
    }

    [HttpPut("api/bonus/{id}")]
    public async Task<IActionResult> UpdateBonus(int id, [FromBody] UpdateBonusRequest req)
    {
        if (req.Amount <= 0)
            return BadRequest(new { error = "Enter a positive dollar amount." });

        var bonus = await _db.BonusAllocations.FindAsync(id);
        if (bonus == null) return NotFound(new { error = "Bonus not found." });

        bonus.Amount = req.Amount;
        bonus.Description = req.Description?.Trim() ?? "";
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    [HttpDelete("api/bonus/{id}")]
    public async Task<IActionResult> DeleteBonus(int id)
    {
        var bonus = await _db.BonusAllocations.FindAsync(id);
        if (bonus == null) return NotFound(new { error = "Bonus not found." });

        _db.BonusAllocations.Remove(bonus);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }
}
