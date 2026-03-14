using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;
using Pocketfolio.Api.Tests.Helpers;
using Xunit;

namespace Pocketfolio.Api.Tests.Services;

public class BudgetEngineTests
{
    [Fact]
    public void PeriodForDate_OnCycleStart_ReturnsPeriod1()
    {
        using var db = TestDbContextFactory.Create();
        db.Settings.Add(new Setting { Key = "pay_cycle_start", Value = "2026-03-12" });
        db.SaveChanges();

        var engine = new BudgetEngine(db);
        var result = engine.PeriodForDate(new DateTime(2026, 3, 12));

        Assert.Equal(1, result.Period);
        Assert.Equal(new DateTime(2026, 3, 12), result.Start);
        Assert.Equal(new DateTime(2026, 3, 25), result.End);
    }

    [Fact]
    public void PeriodForDate_MidPeriod_ReturnsCorrectPeriod()
    {
        using var db = TestDbContextFactory.Create();
        db.Settings.Add(new Setting { Key = "pay_cycle_start", Value = "2026-03-12" });
        db.SaveChanges();

        var engine = new BudgetEngine(db);
        // Day 15 from cycle start = period 2
        var result = engine.PeriodForDate(new DateTime(2026, 3, 27));

        Assert.Equal(2, result.Period);
        Assert.Equal(new DateTime(2026, 3, 26), result.Start);
    }

    [Fact]
    public void PeriodForDate_BeforeCycleStart_ReturnsNegativePeriod()
    {
        using var db = TestDbContextFactory.Create();
        db.Settings.Add(new Setting { Key = "pay_cycle_start", Value = "2026-03-12" });
        db.SaveChanges();

        var engine = new BudgetEngine(db);
        var result = engine.PeriodForDate(new DateTime(2026, 3, 1));

        Assert.True(result.Period <= 0);
    }

    [Fact]
    public void CumulativeBudget_NoBudgetChanges_ReturnsZero()
    {
        using var db = TestDbContextFactory.Create();
        var engine = new BudgetEngine(db);

        var result = engine.CumulativeBudget(envelopeId: 999, upToPeriod: 5);

        Assert.Equal(0m, result);
    }

    [Fact]
    public void CumulativeBudget_SingleRate_MultipliesByPeriods()
    {
        using var db = TestDbContextFactory.Create();
        var envelope = new Envelope { Name = "Test", GroupName = "Test", BudgetFn = 100 };
        db.Envelopes.Add(envelope);
        db.SaveChanges();

        db.BudgetChanges.Add(new BudgetChange
        {
            EnvelopeId = envelope.Id,
            BudgetFn = 100,
            EffectivePeriod = 1,
        });
        db.SaveChanges();

        var engine = new BudgetEngine(db);
        var result = engine.CumulativeBudget(envelope.Id, upToPeriod: 3);

        Assert.Equal(300m, result); // 100 * 3 periods
    }

    [Fact]
    public void CumulativeBudget_WithRateChange_ComputesCorrectly()
    {
        using var db = TestDbContextFactory.Create();
        var envelope = new Envelope { Name = "Test", GroupName = "Test", BudgetFn = 100 };
        db.Envelopes.Add(envelope);
        db.SaveChanges();

        db.BudgetChanges.Add(new BudgetChange { EnvelopeId = envelope.Id, BudgetFn = 100, EffectivePeriod = 1 });
        db.BudgetChanges.Add(new BudgetChange { EnvelopeId = envelope.Id, BudgetFn = 200, EffectivePeriod = 3 });
        db.SaveChanges();

        var engine = new BudgetEngine(db);
        // Periods 1-2 at 100, periods 3-4 at 200
        var result = engine.CumulativeBudget(envelope.Id, upToPeriod: 4);

        Assert.Equal(600m, result); // (100*2) + (200*2)
    }

    [Fact]
    public void CumulativeBudget_WithBonusAllocation_IncludesBonus()
    {
        using var db = TestDbContextFactory.Create();
        var envelope = new Envelope { Name = "Test", GroupName = "Test", BudgetFn = 100 };
        db.Envelopes.Add(envelope);
        db.SaveChanges();

        db.BudgetChanges.Add(new BudgetChange { EnvelopeId = envelope.Id, BudgetFn = 100, EffectivePeriod = 1 });
        db.BonusAllocations.Add(new BonusAllocation { EnvelopeId = envelope.Id, Amount = 50, Period = 2 });
        db.SaveChanges();

        var engine = new BudgetEngine(db);
        var result = engine.CumulativeBudget(envelope.Id, upToPeriod: 3);

        Assert.Equal(350m, result); // (100*3) + 50 bonus
    }

    [Fact]
    public void CumulativeBudget_ZeroOrNegativePeriod_ReturnsZero()
    {
        using var db = TestDbContextFactory.Create();
        var engine = new BudgetEngine(db);

        Assert.Equal(0m, engine.CumulativeBudget(1, upToPeriod: 0));
        Assert.Equal(0m, engine.CumulativeBudget(1, upToPeriod: -1));
    }

    [Fact]
    public void GetRateForPeriod_ReturnsActiveRate()
    {
        using var db = TestDbContextFactory.Create();
        var envelope = new Envelope { Name = "Test", GroupName = "Test", BudgetFn = 100 };
        db.Envelopes.Add(envelope);
        db.SaveChanges();

        db.BudgetChanges.Add(new BudgetChange { EnvelopeId = envelope.Id, BudgetFn = 100, EffectivePeriod = 1 });
        db.BudgetChanges.Add(new BudgetChange { EnvelopeId = envelope.Id, BudgetFn = 150, EffectivePeriod = 5 });
        db.SaveChanges();

        var engine = new BudgetEngine(db);

        Assert.Equal(100m, engine.GetRateForPeriod(envelope.Id, periodNum: 3));
        Assert.Equal(150m, engine.GetRateForPeriod(envelope.Id, periodNum: 5));
        Assert.Equal(150m, engine.GetRateForPeriod(envelope.Id, periodNum: 10));
    }

    [Fact]
    public void GetInvestmentCash_DepositsMinusTrades()
    {
        using var db = TestDbContextFactory.Create();
        var envelope = new Envelope { Name = "Invest", GroupName = "Test", BudgetFn = 500, Ticker = "VDHG.AX" };
        db.Envelopes.Add(envelope);
        db.SaveChanges();

        var holding = new PortfolioHolding { Ticker = "VDHG.AX", Name = "VDHG", Shares = 10, CostBasis = 500 };
        db.PortfolioHoldings.Add(holding);
        db.SaveChanges();

        db.Transactions.Add(new Transaction { EnvelopeId = envelope.Id, Amount = 1000, Date = DateTime.Today, Description = "deposit" });
        db.Trades.Add(new Trade { EnvelopeId = envelope.Id, HoldingId = holding.Id, Shares = 10, Price = 50, Fees = 10, TotalCost = 510, Date = DateTime.Today });
        db.SaveChanges();

        var engine = new BudgetEngine(db);
        var cash = engine.GetInvestmentCash(envelope.Id);

        Assert.Equal(490m, cash); // 1000 - 510
    }

    [Fact]
    public void PeriodsElapsedAtEnd_NeverNegative()
    {
        using var db = TestDbContextFactory.Create();
        var engine = new BudgetEngine(db);

        Assert.Equal(0, engine.PeriodsElapsedAtEnd(-5));
        Assert.Equal(0, engine.PeriodsElapsedAtEnd(0));
        Assert.Equal(3, engine.PeriodsElapsedAtEnd(3));
    }
}
