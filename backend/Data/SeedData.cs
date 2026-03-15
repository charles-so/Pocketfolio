using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Entities;

namespace Pocketfolio.Api.Data;

public static class SeedData
{
    public static readonly (string Name, string Group, decimal Budget, int SortOrder, string? Ticker)[] DefaultEnvelopes =
    [
        ("Rent", "Housing", 440, 1, null),
        ("Fuel", "Transport", 83, 10, null),
        ("Car Rego", "Transport", 46, 11, null),
        ("Car Insurance", "Transport", 54, 12, null),
        ("Car Maintenance", "Transport", 46, 13, null),
        ("Car Unexpected", "Transport", 20, 14, null),
        ("Groceries", "Living", 231, 20, null),
        ("Dining Out", "Living", 230, 21, null),
        ("Utilities", "Living", 69, 22, null),
        ("Clothing & Shoes", "Living", 38, 23, null),
        ("Haircuts", "Living", 20, 24, null),
        ("Personal Care", "Living", 20, 25, null),
        ("Cleaning Supplies", "Living", 10, 26, null),
        ("Cat Food", "Cat", 50, 30, null),
        ("Cat Litter", "Cat", 20, 31, null),
        ("Cat Vet", "Cat", 19, 32, null),
        ("Cat Flea & Worming", "Cat", 8, 33, null),
        ("Bupa Health", "Health & Insurance", 46, 40, null),
        ("Gym", "Health & Insurance", 27, 41, null),
        ("Pet Insurance", "Health & Insurance", 20, 42, null),
        ("Medical & Dental", "Health & Insurance", 23, 43, null),
        ("Mobile", "Subscriptions", 17, 50, null),
        ("AI Tools", "Subscriptions", 17, 51, null),
        ("Apple One", "Subscriptions", 23, 52, null),
        ("NordVPN", "Subscriptions", 6, 53, null),
        ("Microsoft 365", "Subscriptions", 7, 54, null),
        ("Gifts", "Social & Gifts", 23, 60, null),
        ("Holidays & Fun", "Fun Fund", 500, 70, null),
        ("VDHG", "Investments", 987, 80, "VDHG.AX"),
    ];

    public const string DefaultPayCycleStart = "2026-03-12";

    public static async Task InitializeAsync(AppDbContext db)
    {
        if (!await db.Envelopes.AnyAsync())
        {
            foreach (var (name, group, budget, sort, ticker) in DefaultEnvelopes)
            {
                db.Envelopes.Add(new Envelope
                {
                    Name = name,
                    GroupName = group,
                    BudgetFn = budget,
                    SortOrder = sort,
                    Ticker = ticker,
                });
            }
            await db.SaveChangesAsync();

            foreach (var env in await db.Envelopes.ToListAsync())
            {
                db.BudgetChanges.Add(new BudgetChange
                {
                    EnvelopeId = env.Id,
                    BudgetFn = env.BudgetFn,
                    EffectivePeriod = 1,
                });
            }
            await db.SaveChangesAsync();
        }

        if (!await db.Settings.AnyAsync())
        {
            db.Settings.AddRange(
                new Setting { Key = "pay_cycle_start", Value = DefaultPayCycleStart }
            );
            await db.SaveChangesAsync();
        }

        if (!await db.RecurringItems.AnyAsync(r => r.IsSystem))
        {
            var totalBudget = await db.Envelopes.SumAsync(e => (decimal?)e.BudgetFn) ?? DefaultEnvelopes.Sum(e => e.Budget);
            db.RecurringItems.Add(new RecurringItem
            {
                Type = "Income",
                Amount = totalBudget,
                Description = "Fortnightly Paycheck",
                IncomeType = "Paycheck",
                StartDate = DateTime.Parse((await db.Settings.FirstOrDefaultAsync(s => s.Key == "pay_cycle_start"))?.Value ?? DefaultPayCycleStart),
                Frequency = "Fortnightly",
                Active = true,
                IsSystem = true,
            });
            await db.SaveChangesAsync();
        }

        if (!await db.PortfolioHoldings.AnyAsync())
        {
            db.PortfolioHoldings.Add(new PortfolioHolding
            {
                Ticker = "VDHG.AX",
                Name = "Vanguard Diversified High Growth",
                Shares = 0,
                CostBasis = 0,
            });
            await db.SaveChangesAsync();
        }
    }
}
