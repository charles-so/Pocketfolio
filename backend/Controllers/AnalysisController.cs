using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
[Route("api/analysis")]
public class AnalysisController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BudgetEngine _engine;

    public AnalysisController(AppDbContext db, BudgetEngine engine)
    {
        _db = db;
        _engine = engine;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] int periods = 6,
        [FromQuery] int? envelope_id = null,
        [FromQuery] string? group_name = null,
        [FromQuery] string? date_from = null,
        [FromQuery] string? date_to = null)
    {
        // Parse optional date filters
        DateTime? filterDateFrom = null, filterDateTo = null;
        if (!string.IsNullOrEmpty(date_from) && DateTime.TryParse(date_from, out var parsedFrom))
            filterDateFrom = parsedFrom;
        if (!string.IsNullOrEmpty(date_to) && DateTime.TryParse(date_to, out var parsedTo))
            filterDateTo = parsedTo;

        var today = DateTime.Today;
        var (currentPeriod, _, _) = _engine.PeriodForDate(today);
        currentPeriod = Math.Max(currentPeriod, 1);

        var currentStart = _engine.CycleStart.AddDays((currentPeriod - 1) * 14);
        var currentEnd = currentStart.AddDays(13);

        int firstPeriod;
        DateTime rangeStart;
        if (periods > 0)
        {
            firstPeriod = Math.Max(currentPeriod - periods + 1, 1);
            rangeStart = _engine.CycleStart.AddDays((firstPeriod - 1) * 14);
        }
        else
        {
            firstPeriod = 1;
            rangeStart = _engine.CycleStart;
        }
        var rangeEnd = currentEnd;

        // Override date range if explicit date filters provided
        if (filterDateFrom.HasValue) rangeStart = filterDateFrom.Value;
        if (filterDateTo.HasValue) rangeEnd = filterDateTo.Value;

        // Recalculate period range when date filters active
        if (filterDateFrom.HasValue || filterDateTo.HasValue)
        {
            var (fp, _, _) = _engine.PeriodForDate(rangeStart);
            firstPeriod = Math.Max(fp, 1);
            var (lp, _, _) = _engine.PeriodForDate(rangeEnd);
            currentPeriod = Math.Max(lp, 1);
        }

        // Get investment envelope IDs to exclude
        var excludeIds = await _db.Envelopes
            .Where(e => e.GroupName == "Investments")
            .Select(e => e.Id)
            .ToListAsync();

        // Total spending (excluding investments, with optional filters)
        var totalSpent = await GetFilteredSpending(rangeStart, rangeEnd, excludeIds, envelope_id, group_name);
        var txnCountQuery = _db.Transactions
            .Where(t => t.Date >= rangeStart && t.Date <= rangeEnd
                        && !excludeIds.Contains(t.EnvelopeId));
        if (envelope_id.HasValue)
            txnCountQuery = txnCountQuery.Where(t => t.EnvelopeId == envelope_id.Value);
        if (!string.IsNullOrEmpty(group_name))
        {
            var grpIds = await _db.Envelopes.Where(e => e.GroupName == group_name).Select(e => e.Id).ToListAsync();
            txnCountQuery = txnCountQuery.Where(t => grpIds.Contains(t.EnvelopeId));
        }
        var txnCount = await txnCountQuery.CountAsync();

        var thisPeriodSpent = await GetFilteredSpending(currentStart, currentEnd, excludeIds, envelope_id, group_name);

        decimal lastPeriodSpent = 0;
        if (currentPeriod > 1)
        {
            var lastStart = _engine.CycleStart.AddDays((currentPeriod - 2) * 14);
            var lastEnd = lastStart.AddDays(13);
            lastPeriodSpent = await GetFilteredSpending(lastStart, lastEnd, excludeIds, envelope_id, group_name);
        }

        int numPeriods = Math.Max(currentPeriod - firstPeriod + 1, 1);
        var avgPerPeriod = numPeriods > 0 ? totalSpent / numPeriods : 0;

        // Spending by group (with filters)
        var txnsQuery = _db.Transactions
            .Where(t => t.Amount > 0 && t.Date >= rangeStart && t.Date <= rangeEnd
                        && !excludeIds.Contains(t.EnvelopeId));
        if (envelope_id.HasValue)
            txnsQuery = txnsQuery.Where(t => t.EnvelopeId == envelope_id.Value);
        if (!string.IsNullOrEmpty(group_name))
        {
            var groupEnvIds = await _db.Envelopes
                .Where(e => e.GroupName == group_name)
                .Select(e => e.Id)
                .ToListAsync();
            txnsQuery = txnsQuery.Where(t => groupEnvIds.Contains(t.EnvelopeId));
        }
        var txnsInRange = await txnsQuery.ToListAsync();
        var envelopeLookup = (await _db.Envelopes.ToListAsync()).ToDictionary(e => e.Id);

        var byGroup = txnsInRange
            .Where(t => envelopeLookup.ContainsKey(t.EnvelopeId))
            .GroupBy(t => envelopeLookup[t.EnvelopeId].GroupName)
            .Select(g => new GroupSpendingDto(g.Key, g.Sum(t => t.Amount)))
            .OrderByDescending(g => g.Total)
            .ToList();

        // Top envelopes
        var topEnvelopes = txnsInRange
            .Where(t => envelopeLookup.ContainsKey(t.EnvelopeId))
            .GroupBy(t => t.EnvelopeId)
            .Select(g => {
                var env = envelopeLookup[g.Key];
                return new EnvelopeSpendingDto(env.Id, env.Name, env.GroupName, g.Sum(t => t.Amount));
            })
            .OrderByDescending(g => g.Total)
            .Take(10)
            .ToList();

        // Spending trend
        var trend = new List<TrendPointDto>();
        for (int p = firstPeriod; p <= currentPeriod; p++)
        {
            var pStart = _engine.CycleStart.AddDays((p - 1) * 14);
            var pEnd = pStart.AddDays(13);
            var pTotal = await GetFilteredSpending(pStart, pEnd, excludeIds, envelope_id, group_name);
            trend.Add(new TrendPointDto(p, $"P{p}", Math.Round(pTotal, 2)));
        }

        // Budget vs actual
        var allEnvelopes = await _db.Envelopes.OrderBy(e => e.SortOrder).ToListAsync();
        var spendingPerEnvelope = txnsInRange
            .GroupBy(t => t.EnvelopeId)
            .ToDictionary(g => g.Key, g => g.Sum(t => t.Amount));

        var budgetVsActual = new List<BudgetVsActualDto>();
        foreach (var env in allEnvelopes)
        {
            if (excludeIds.Contains(env.Id)) continue;
            if (envelope_id.HasValue && env.Id != envelope_id.Value) continue;
            if (!string.IsNullOrEmpty(group_name) && env.GroupName != group_name) continue;

            decimal budgetTotal = 0;
            for (int p = firstPeriod; p <= currentPeriod; p++)
            {
                budgetTotal += _engine.GetRateForPeriod(env.Id, p);
                budgetTotal += _db.BonusAllocations
                    .Where(b => b.EnvelopeId == env.Id && b.Period == p)
                    .Sum(b => (decimal?)b.Amount) ?? 0m;
            }

            var actual = spendingPerEnvelope.GetValueOrDefault(env.Id, 0);
            if (budgetTotal > 0 || actual > 0)
            {
                budgetVsActual.Add(new BudgetVsActualDto(
                    env.Name, env.GroupName,
                    Math.Round(budgetTotal, 2),
                    Math.Round(actual, 2)));
            }
        }

        // Investment summary
        var investmentEnvs = await _db.Envelopes
            .Where(e => e.GroupName == "Investments" && e.Ticker != null)
            .ToListAsync();
        var investmentSummary = new List<InvestmentSummaryDto>();
        foreach (var env in investmentEnvs)
        {
            var deposited = await _db.Transactions
                .Where(t => t.EnvelopeId == env.Id)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var traded = await _db.Trades
                .Where(t => t.EnvelopeId == env.Id)
                .SumAsync(t => (decimal?)t.TotalCost) ?? 0m;
            investmentSummary.Add(new InvestmentSummaryDto(
                env.Id, env.Ticker!, env.Name,
                Math.Round(deposited, 2), Math.Round(traded, 2),
                Math.Round(deposited - traded, 2)));
        }

        // Income analysis
        var incomesInRange = await _db.Incomes
            .Where(i => i.Date >= rangeStart && i.Date <= rangeEnd)
            .ToListAsync();

        var totalIncome = incomesInRange.Sum(i => i.Amount);

        var thisPeriodIncome = await _db.Incomes
            .Where(i => i.Date >= currentStart && i.Date <= currentEnd)
            .SumAsync(i => (decimal?)i.Amount) ?? 0m;

        decimal lastPeriodIncome = 0;
        if (currentPeriod > 1)
        {
            var lastStart = _engine.CycleStart.AddDays((currentPeriod - 2) * 14);
            var lastEnd = lastStart.AddDays(13);
            lastPeriodIncome = await _db.Incomes
                .Where(i => i.Date >= lastStart && i.Date <= lastEnd)
                .SumAsync(i => (decimal?)i.Amount) ?? 0m;
        }

        var avgIncomePerPeriod = numPeriods > 0 ? totalIncome / numPeriods : 0;

        var incomeByType = incomesInRange
            .GroupBy(i => i.Type)
            .Select(g => new IncomeByTypeDto(g.Key, g.Sum(i => i.Amount)))
            .OrderByDescending(g => g.Total)
            .ToList();

        // Income trend
        var incomeTrend = new List<TrendPointDto>();
        for (int p = firstPeriod; p <= currentPeriod; p++)
        {
            var pStart = _engine.CycleStart.AddDays((p - 1) * 14);
            var pEnd = pStart.AddDays(13);
            var pIncome = await _db.Incomes
                .Where(i => i.Date >= pStart && i.Date <= pEnd)
                .SumAsync(i => (decimal?)i.Amount) ?? 0m;
            incomeTrend.Add(new TrendPointDto(p, $"P{p}", Math.Round(pIncome, 2)));
        }

        // Available groups and envelopes for filter dropdowns
        var availableGroups = await _db.Envelopes
            .Where(e => e.GroupName != "Investments")
            .Select(e => e.GroupName)
            .Distinct()
            .OrderBy(g => g)
            .ToListAsync();

        var availableEnvelopes = await _db.Envelopes
            .Where(e => e.GroupName != "Investments")
            .OrderBy(e => e.SortOrder)
            .Select(e => new { e.Id, e.Name, e.GroupName })
            .ToListAsync();

        return Ok(new AnalysisResponse(
            Math.Round(totalSpent, 2),
            Math.Round(thisPeriodSpent, 2),
            Math.Round(lastPeriodSpent, 2),
            Math.Round(avgPerPeriod, 2),
            txnCount,
            Math.Round(totalIncome, 2),
            Math.Round(thisPeriodIncome, 2),
            Math.Round(lastPeriodIncome, 2),
            Math.Round(avgIncomePerPeriod, 2),
            byGroup, incomeByType, topEnvelopes, trend, incomeTrend,
            budgetVsActual, investmentSummary,
            availableGroups,
            availableEnvelopes.Select(e => new FilterEnvelopeDto(e.Id, e.Name, e.GroupName)).ToList()));
    }

    [HttpGet("investment-projection")]
    public async Task<IActionResult> GetInvestmentProjection()
    {
        var today = DateTime.Today;
        var (currentPeriod, _, _) = _engine.PeriodForDate(today);
        currentPeriod = Math.Max(currentPeriod, 1);

        var investmentEnvs = await _db.Envelopes
            .Where(e => e.GroupName == "Investments" && e.Ticker != null)
            .ToListAsync();

        var projections = new List<object>();
        decimal totalFortnightlyContribution = 0;

        foreach (var env in investmentEnvs)
        {
            var currentRate = _engine.GetRateForPeriod(env.Id, currentPeriod);
            totalFortnightlyContribution += currentRate;

            var holding = await _db.PortfolioHoldings
                .FirstOrDefaultAsync(h => h.Ticker == env.Ticker);

            var deposited = await _db.Transactions
                .Where(t => t.EnvelopeId == env.Id)
                .SumAsync(t => (decimal?)t.Amount) ?? 0m;
            var traded = await _db.Trades
                .Where(t => t.EnvelopeId == env.Id)
                .SumAsync(t => (decimal?)t.TotalCost) ?? 0m;

            decimal costBasis = holding?.CostBasis ?? 0;
            decimal shares = holding?.Shares ?? 0;

            projections.Add(new
            {
                ticker = env.Ticker,
                name = env.Name,
                budgetPerFortnight = currentRate,
                totalDeposited = Math.Round(deposited, 2),
                totalTraded = Math.Round(traded, 2),
                currentShares = shares,
                costBasis = Math.Round(costBasis, 2),
            });
        }

        return Ok(new
        {
            currentPeriod,
            totalFortnightlyContribution = Math.Round(totalFortnightlyContribution, 2),
            annualContribution = Math.Round(totalFortnightlyContribution * 26, 2),
            investments = projections,
            periodsElapsed = currentPeriod,
        });
    }

    private async Task<decimal> GetFilteredSpending(DateTime start, DateTime end, List<int> excludeIds, int? envelopeId, string? groupName)
    {
        var q = _db.Transactions
            .Where(t => t.Amount > 0 && t.Date >= start && t.Date <= end
                        && !excludeIds.Contains(t.EnvelopeId));
        if (envelopeId.HasValue)
            q = q.Where(t => t.EnvelopeId == envelopeId.Value);
        if (!string.IsNullOrEmpty(groupName))
        {
            var grpIds = await _db.Envelopes.Where(e => e.GroupName == groupName).Select(e => e.Id).ToListAsync();
            q = q.Where(t => grpIds.Contains(t.EnvelopeId));
        }
        return await q.SumAsync(t => (decimal?)t.Amount) ?? 0m;
    }
}
