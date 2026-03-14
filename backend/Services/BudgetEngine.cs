using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Entities;

namespace Pocketfolio.Api.Services;

public class BudgetEngine
{
    private readonly AppDbContext _db;

    public BudgetEngine(AppDbContext db)
    {
        _db = db;
    }

    public DateTime CycleStart
    {
        get
        {
            var s = _db.Settings.FirstOrDefault(s => s.Key == "pay_cycle_start");
            return DateTime.Parse(s?.Value ?? SeedData.DefaultPayCycleStart);
        }
    }

    /// <summary>
    /// Return (periodNumber, startDate, endDate) for the period containing date d.
    /// Period 1 starts on CycleStart. Each period is 14 days.
    /// </summary>
    public (int Period, DateTime Start, DateTime End) PeriodForDate(DateTime d)
    {
        int delta = (d.Date - CycleStart.Date).Days;
        int periodNum;
        if (delta >= 0)
            periodNum = delta / 14 + 1;
        else
            periodNum = -((-delta - 1) / 14);

        var start = CycleStart.Date.AddDays((periodNum - 1) * 14);
        var end = start.AddDays(13);
        return (periodNum, start, end);
    }

    /// <summary>How many complete periods have elapsed (including this one) from period 1.</summary>
    public int PeriodsElapsedAtEnd(int periodNum) => Math.Max(periodNum, 0);

    /// <summary>
    /// Sum budget across all periods 1..upToPeriod, respecting rate changes + bonus allocations.
    /// </summary>
    public decimal CumulativeBudget(int envelopeId, int upToPeriod)
    {
        if (upToPeriod <= 0) return 0m;

        var changes = _db.BudgetChanges
            .Where(bc => bc.EnvelopeId == envelopeId)
            .OrderBy(bc => bc.EffectivePeriod)
            .ThenBy(bc => bc.Id)
            .ToList();

        if (changes.Count == 0) return 0m;

        decimal cumulative = 0m;
        for (int i = 0; i < changes.Count; i++)
        {
            int startP = Math.Max(changes[i].EffectivePeriod, 1);
            if (startP > upToPeriod) break;

            int endP;
            if (i + 1 < changes.Count)
                endP = Math.Min(changes[i + 1].EffectivePeriod - 1, upToPeriod);
            else
                endP = upToPeriod;

            int periodsAtRate = Math.Max(0, endP - startP + 1);
            cumulative += changes[i].BudgetFn * periodsAtRate;
        }

        // Add one-time bonus allocations
        cumulative += _db.BonusAllocations
            .Where(b => b.EnvelopeId == envelopeId && b.Period <= upToPeriod)
            .Sum(b => b.Amount);

        return cumulative;
    }

    /// <summary>Return the budget rate active during a specific period.</summary>
    public decimal GetRateForPeriod(int envelopeId, int periodNum)
    {
        var changes = _db.BudgetChanges
            .Where(bc => bc.EnvelopeId == envelopeId)
            .OrderBy(bc => bc.EffectivePeriod)
            .ThenBy(bc => bc.Id)
            .ToList();

        decimal rate = 0m;
        foreach (var change in changes)
        {
            if (change.EffectivePeriod <= periodNum)
                rate = change.BudgetFn;
            else
                break;
        }
        return rate;
    }

    /// <summary>Compute budget status for an envelope at a given period.</summary>
    public EnvelopeStatusResult EnvelopeStatus(Envelope envelope, int periodNum, DateTime periodEnd)
    {
        var rate = GetRateForPeriod(envelope.Id, periodNum);
        var periods = PeriodsElapsedAtEnd(periodNum);
        var cumBudget = CumulativeBudget(envelope.Id, periods);

        // Total spent up to end of this period
        var spentTotal = _db.Transactions
            .Where(t => t.EnvelopeId == envelope.Id && t.Date <= periodEnd)
            .Sum(t => (decimal?)t.Amount) ?? 0m;

        // Spent just in this period
        var periodStart = periodEnd.AddDays(-13);
        var spentPeriod = _db.Transactions
            .Where(t => t.EnvelopeId == envelope.Id && t.Date >= periodStart && t.Date <= periodEnd)
            .Sum(t => (decimal?)t.Amount) ?? 0m;

        var available = cumBudget - spentTotal;

        // Rollover = available minus this period's budget
        var rollover = available - rate;
        if (periodNum <= 1)
            rollover = Math.Max(rollover, 0);

        // Bonus allocated in this period (for display only — already in cumBudget)
        var bonus = _db.BonusAllocations
            .Where(b => b.EnvelopeId == envelope.Id && b.Period == periodNum)
            .Sum(b => (decimal?)b.Amount) ?? 0m;

        return new EnvelopeStatusResult
        {
            BudgetFn = rate,
            SpentPeriod = spentPeriod,
            SpentTotal = spentTotal,
            CumulativeBudget = cumBudget,
            Available = available,
            Rollover = rollover,
            Bonus = bonus,
        };
    }

    /// <summary>Cash available to trade = total deposited minus total trade costs.</summary>
    public decimal GetInvestmentCash(int envelopeId)
    {
        var deposited = _db.Transactions
            .Where(t => t.EnvelopeId == envelopeId)
            .Sum(t => (decimal?)t.Amount) ?? 0m;
        var traded = _db.Trades
            .Where(t => t.EnvelopeId == envelopeId)
            .Sum(t => (decimal?)t.TotalCost) ?? 0m;
        return Math.Round(deposited - traded, 2);
    }
}

public class EnvelopeStatusResult
{
    public decimal BudgetFn { get; set; }
    public decimal SpentPeriod { get; set; }
    public decimal SpentTotal { get; set; }
    public decimal CumulativeBudget { get; set; }
    public decimal Available { get; set; }
    public decimal Rollover { get; set; }
    public decimal Bonus { get; set; }
}
