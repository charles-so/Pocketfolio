using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
[Route("api/envelopes")]
public class EnvelopesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BudgetEngine _engine;

    public EnvelopesController(AppDbContext db, BudgetEngine engine)
    {
        _db = db;
        _engine = engine;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEnvelopeRequest req)
    {
        var name = req.Name?.Trim() ?? "";
        if (string.IsNullOrEmpty(name))
            return BadRequest(new { error = "Envelope name cannot be empty." });

        if (await _db.Envelopes.AnyAsync(e => e.Name.ToLower() == name.ToLower()))
            return BadRequest(new { error = $"An envelope named \"{name}\" already exists." });

        var group = req.GroupName?.Trim() ?? "";
        if (string.IsNullOrEmpty(group))
            return BadRequest(new { error = "Group cannot be empty." });

        if (req.BudgetFn < 0)
            return BadRequest(new { error = "Enter a non-negative dollar amount for budget." });

        // Auto sort order
        var groupOrders = await _db.Envelopes
            .Where(e => e.GroupName == group)
            .Select(e => e.SortOrder)
            .ToListAsync();

        int sortOrder;
        if (groupOrders.Count > 0)
            sortOrder = groupOrders.Max() + 1;
        else
        {
            var maxOrder = await _db.Envelopes.MaxAsync(e => (int?)e.SortOrder) ?? 0;
            sortOrder = ((maxOrder / 10) + 1) * 10;
        }

        var ticker = string.IsNullOrWhiteSpace(req.Ticker) ? null : req.Ticker.Trim().ToUpper();

        var envelope = new Envelope
        {
            Name = name,
            GroupName = group,
            BudgetFn = req.BudgetFn,
            SortOrder = sortOrder,
            Ticker = ticker,
        };
        _db.Envelopes.Add(envelope);
        await _db.SaveChangesAsync();

        _db.BudgetChanges.Add(new BudgetChange
        {
            EnvelopeId = envelope.Id,
            BudgetFn = req.BudgetFn,
            EffectivePeriod = 1,
        });
        await _db.SaveChangesAsync();

        // Auto-create portfolio holding for Investment envelopes
        if (group == "Investments" && ticker != null)
        {
            var existing = await _db.PortfolioHoldings.FirstOrDefaultAsync(h => h.Ticker == ticker);
            if (existing == null)
            {
                var tickerInfo = await _db.TickerDirectory.FirstOrDefaultAsync(t => t.Ticker == ticker);
                _db.PortfolioHoldings.Add(new PortfolioHolding
                {
                    Ticker = ticker,
                    Name = tickerInfo?.Name ?? name,
                    Shares = 0,
                    CostBasis = 0,
                });
                await _db.SaveChangesAsync();
            }
        }

        return Ok(new { ok = true, id = envelope.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEnvelopeRequest req)
    {
        var name = req.Name?.Trim() ?? "";
        if (string.IsNullOrEmpty(name))
            return BadRequest(new { error = "Envelope name cannot be empty." });

        if (await _db.Envelopes.AnyAsync(e => e.Name.ToLower() == name.ToLower() && e.Id != id))
            return BadRequest(new { error = $"An envelope named \"{name}\" already exists." });

        var group = req.GroupName?.Trim() ?? "";
        if (string.IsNullOrEmpty(group))
            return BadRequest(new { error = "Group cannot be empty." });

        var envelope = await _db.Envelopes.FindAsync(id);
        if (envelope == null) return NotFound(new { error = "Envelope not found." });

        envelope.Name = name;
        envelope.GroupName = group;
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var envelope = await _db.Envelopes.FindAsync(id);
        if (envelope == null) return NotFound(new { error = "Envelope not found." });

        // Cascade delete related data
        await _db.BudgetChanges.Where(bc => bc.EnvelopeId == id).ExecuteDeleteAsync();
        await _db.Transactions.Where(t => t.EnvelopeId == id).ExecuteDeleteAsync();
        await _db.BonusAllocations.Where(b => b.EnvelopeId == id).ExecuteDeleteAsync();
        _db.Envelopes.Remove(envelope);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    [HttpPut("{id}/budget")]
    public async Task<IActionResult> UpdateBudget(int id, [FromBody] UpdateBudgetRequest req)
    {
        if (req.BudgetFn < 0)
            return BadRequest(new { error = "Enter a valid non-negative dollar amount." });

        var envelope = await _db.Envelopes.FindAsync(id);
        if (envelope == null) return NotFound(new { error = "Envelope not found." });

        var (currentPeriod, _, _) = _engine.PeriodForDate(DateTime.Today);
        currentPeriod = Math.Max(currentPeriod, 1);

        _db.BudgetChanges.Add(new BudgetChange
        {
            EnvelopeId = id,
            BudgetFn = req.BudgetFn,
            EffectivePeriod = currentPeriod,
        });
        envelope.BudgetFn = req.BudgetFn;
        await _db.SaveChangesAsync();

        return Ok(new { ok = true });
    }

    [HttpGet("{id}/transaction_count")]
    public async Task<IActionResult> TransactionCount(int id)
    {
        var count = await _db.Transactions.CountAsync(t => t.EnvelopeId == id);
        return Ok(new { count });
    }

    [HttpGet("{id}/details")]
    public async Task<IActionResult> Details(int id)
    {
        var envelope = await _db.Envelopes.FindAsync(id);
        if (envelope == null) return NotFound(new { error = "Envelope not found." });

        var today = DateTime.Today;
        var (currentPeriod, _, _) = _engine.PeriodForDate(today);
        currentPeriod = Math.Max(currentPeriod, 1);
        var currentStart = _engine.CycleStart.AddDays((currentPeriod - 1) * 14);
        var currentEnd = currentStart.AddDays(13);

        var txnEntities = await _db.Transactions
            .Where(t => t.EnvelopeId == id)
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.Id)
            .ToListAsync();

        var txnIdList = txnEntities.Select(t => t.Id).ToList();
        var attachInfo = await _db.Attachments
            .Where(a => a.EntityType == "txn" && txnIdList.Contains(a.EntityId))
            .GroupBy(a => a.EntityId)
            .Select(g => new { EntityId = g.Key, Count = g.Count(), FirstName = g.OrderBy(a => a.Id).First().FileName })
            .ToDictionaryAsync(g => g.EntityId);

        var txns = txnEntities.Select(t => {
            var hasAtt = attachInfo.TryGetValue(t.Id, out var info);
            return new EnvelopeTransactionDto(
                t.Id, t.Date.ToString("yyyy-MM-dd"), t.Amount, t.Description,
                hasAtt ? info!.Count : 0, hasAtt ? info!.FirstName : null);
        }).ToList();

        var totalSpent = txns.Where(t => t.Amount > 0).Sum(t => t.Amount);
        var txnCount = txns.Count(t => t.Amount > 0);
        var avgPerTransaction = txnCount > 0 ? Math.Round(totalSpent / txnCount, 2) : 0;

        var periodsWithTxns = txns.Where(t => t.Amount > 0)
            .Select(t => { var (p2, _, _2) = _engine.PeriodForDate(DateTime.Parse(t.Date)); return Math.Max(p2, 1); })
            .Distinct().Count();
        var avgPerPeriod = periodsWithTxns > 0 ? Math.Round(totalSpent / periodsWithTxns, 2) : 0;

        var currentPeriodSpent = await _db.Transactions
            .Where(t => t.EnvelopeId == id && t.Amount > 0 && t.Date >= currentStart && t.Date <= currentEnd)
            .SumAsync(t => (decimal?)t.Amount) ?? 0m;

        decimal lastPeriodSpent = 0;
        if (currentPeriod > 1)
        {
            var lastStart = _engine.CycleStart.AddDays((currentPeriod - 2) * 14);
            var lastEnd = lastStart.AddDays(13);
            lastPeriodSpent = await _db.Transactions
                .Where(t => t.EnvelopeId == id && t.Amount > 0 && t.Date >= lastStart && t.Date <= lastEnd)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
        }

        TransactionHighlightDto? highest = null, lowest = null;
        var positiveTxns = await _db.Transactions
            .Where(t => t.EnvelopeId == id && t.Amount > 0)
            .ToListAsync();
        if (positiveTxns.Count > 0)
        {
            var hi = positiveTxns.OrderByDescending(t => t.Amount).First();
            highest = new TransactionHighlightDto(hi.Amount, hi.Description, hi.Date.ToString("yyyy-MM-dd"));
            var lo = positiveTxns.OrderBy(t => t.Amount).First();
            lowest = new TransactionHighlightDto(lo.Amount, lo.Description, lo.Date.ToString("yyyy-MM-dd"));
        }

        var stats = new EnvelopeStatsDto(
            Math.Round(totalSpent, 2), avgPerPeriod, avgPerTransaction,
            txnCount, Math.Round(currentPeriodSpent, 2), Math.Round(lastPeriodSpent, 2),
            highest, lowest);

        return Ok(new EnvelopeDetailResponse(
            envelope.Id, envelope.Name, envelope.GroupName, envelope.BudgetFn, envelope.Ticker,
            stats, txns));
    }
}
