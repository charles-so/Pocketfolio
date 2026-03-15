using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RecurringService _recurring;
    private readonly BudgetEngine _engine;

    public DashboardController(AppDbContext db, BudgetEngine engine, RecurringService recurring)
    {
        _db = db;
        _engine = engine;
        _recurring = recurring;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int? period, [FromQuery] string? date)
    {
        // Auto-apply system recurring items (paycheck) on schedule
        await _recurring.ApplySystemRecurringItems(DateTime.Today);

        int periodNum;
        if (date != null && DateTime.TryParse(date, out var parsedDate))
        {
            var (p, _, _) = _engine.PeriodForDate(parsedDate);
            periodNum = Math.Max(p, 1);
        }
        else if (period.HasValue)
            periodNum = Math.Max(period.Value, 1);
        else
        {
            var (p, _, _) = _engine.PeriodForDate(DateTime.Today);
            periodNum = Math.Max(p, 1);
        }

        var start = _engine.CycleStart.AddDays((periodNum - 1) * 14);
        var end = start.AddDays(13);

        var envelopes = await _db.Envelopes
            .OrderBy(e => e.SortOrder)
            .ThenBy(e => e.Name)
            .ToListAsync();

        // Split into expense envelopes and investment envelopes, filter out Unallocated
        var expenseEnvelopes = envelopes
            .Where(e => string.IsNullOrEmpty(e.Ticker) && e.Name != "Unallocated")
            .ToList();
        var investmentEnvelopes = envelopes.Where(e => !string.IsNullOrEmpty(e.Ticker)).ToList();

        // ── Expense Groups ──
        var groupedExpenses = expenseEnvelopes
            .GroupBy(e => e.GroupName)
            .ToDictionary(g => g.Key, g => g.ToList());

        decimal totalBudget = 0;
        decimal totalSpent = 0;
        decimal totalAvailable = 0;

        var groupList = new List<GroupDto>();

        foreach (var (groupName, envs) in groupedExpenses)
        {
            decimal gBudget = 0, gSpent = 0, gAvailable = 0;
            var envRows = new List<EnvelopeStatusDto>();

            foreach (var env in envs)
            {
                var status = _engine.EnvelopeStatus(env, periodNum, end);
                gBudget += status.BudgetFn;
                gSpent += status.SpentPeriod;
                gAvailable += status.Available;

                envRows.Add(new EnvelopeStatusDto(
                    env.Id, env.Name, status.BudgetFn, status.SpentPeriod,
                    status.Rollover, status.Available, status.Bonus,
                    null, groupName, null));
            }

            groupList.Add(new GroupDto(groupName, gBudget, gSpent, gAvailable, envRows));
            totalBudget += gBudget;
            totalSpent += gSpent;
            totalAvailable += gAvailable;
        }

        // Remove empty groups (e.g. Others after Unallocated is filtered out)
        groupList.RemoveAll(g => g.Envelopes.Count == 0);

        // ── Investment Envelopes (separate section) ──
        var investmentRows = new List<InvestmentEnvelopeDto>();
        decimal invTotalBudgetFn = 0;
        decimal invTotalRollover = 0;
        decimal invTotalDeposited = 0;
        decimal invTotalCashToInvest = 0;

        foreach (var inv in investmentEnvelopes)
        {
            var status = _engine.EnvelopeStatus(inv, periodNum, end);
            var deposited = _db.Transactions
                .Where(t => t.EnvelopeId == inv.Id)
                .Sum(t => (decimal?)t.Amount) ?? 0m;
            var traded = _db.Trades
                .Where(t => t.EnvelopeId == inv.Id)
                .Sum(t => (decimal?)t.TotalCost) ?? 0m;
            var cashToInvest = Math.Round(deposited - traded, 2);

            // Rollover = cumulative budget - deposited (money you've budgeted but not yet deposited)
            var rollover = status.CumulativeBudget - deposited;
            if (periodNum <= 1) rollover = Math.Max(rollover, 0);

            investmentRows.Add(new InvestmentEnvelopeDto(
                inv.Id, inv.Name, inv.Ticker,
                status.BudgetFn,
                status.CumulativeBudget,
                rollover,
                deposited,
                cashToInvest,
                status.Bonus));

            invTotalBudgetFn += status.BudgetFn;
            invTotalRollover += rollover;
            invTotalDeposited += deposited;
            invTotalCashToInvest += cashToInvest;
        }

        var investmentsSummary = new InvestmentsSummaryDto(
            invTotalBudgetFn, invTotalRollover,
            invTotalDeposited, invTotalCashToInvest,
            investmentRows);

        // Include undeposited investment budget in total available
        totalAvailable += invTotalRollover;

        // ── Income Section ──
        // For period 1, include all income up to period end (no prior period exists)
        var periodIncomeStart = periodNum <= 1 ? DateTime.MinValue : start;
        var periodIncome = await _db.Incomes
            .Where(i => i.Date >= periodIncomeStart && i.Date <= end)
            .SumAsync(i => (decimal?)i.Amount) ?? 0m;

        var cumulativeIncome = await _db.Incomes
            .Where(i => i.Date <= end)
            .SumAsync(i => (decimal?)i.Amount) ?? 0m;

        // Total actually spent (expense transactions + investment deposits)
        var cumulativeSpent = await _db.Transactions
            .Where(t => t.Date <= end)
            .SumAsync(t => (decimal?)t.Amount) ?? 0m;

        var periodSpentStart = periodNum <= 1 ? DateTime.MinValue : start;
        var periodSpent = await _db.Transactions
            .Where(t => t.Date >= periodSpentStart && t.Date <= end)
            .SumAsync(t => (decimal?)t.Amount) ?? 0m;

        var remaining = periodIncome - periodSpent;
        var cumulativeRemaining = cumulativeIncome - cumulativeSpent;

        var incomeRecords = await _db.Incomes
            .Where(i => i.Date >= periodIncomeStart && i.Date <= end)
            .OrderByDescending(i => i.Date)
            .ThenByDescending(i => i.Id)
            .Select(i => new IncomeRecordDto(
                i.Id, i.Amount, i.Date.ToString("yyyy-MM-dd"), i.Type, i.Description))
            .ToListAsync();

        var incomeSummary = new IncomeSummaryDto(
            periodIncome, cumulativeIncome, remaining, cumulativeRemaining, incomeRecords);

        var response = new DashboardResponse(
            periodNum,
            start.ToString("yyyy-MM-dd"),
            end.ToString("yyyy-MM-dd"),
            $"Period {periodNum}: {start:dd MMM} \u2013 {end:dd MMM yyyy}",
            totalBudget, totalSpent, totalAvailable,
            groupList, investmentsSummary, incomeSummary);

        return Ok(response);
    }
}
