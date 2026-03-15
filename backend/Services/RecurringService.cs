using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Entities;

namespace Pocketfolio.Api.Services;

public class RecurringService
{
    private readonly AppDbContext _db;

    public RecurringService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Auto-apply system recurring items (paycheck) up to the given date.
    /// The paycheck amount is always recalculated from the sum of all envelope budgets.
    /// This runs automatically on dashboard load — no user confirmation needed.
    /// </summary>
    public async Task ApplySystemRecurringItems(DateTime upToDate)
    {
        var systemItems = await _db.RecurringItems
            .Where(r => r.IsSystem && r.Active)
            .ToListAsync();

        if (systemItems.Count == 0) return;

        // Calculate total budget from all envelopes
        var totalBudget = await _db.Envelopes.SumAsync(e => (decimal?)e.BudgetFn) ?? 0m;

        int created = 0;

        foreach (var item in systemItems)
        {
            // Always sync the amount with total budget
            item.Amount = totalBudget;

            DateTime nextDate;
            if (item.LastAppliedDate == null)
                nextDate = item.StartDate.Date;
            else
                nextDate = NextDueDate(item.LastAppliedDate.Value, item.Frequency);

            if (nextDate > upToDate) continue;

            DateTime lastGenerated = nextDate;

            while (nextDate <= upToDate)
            {
                lastGenerated = nextDate;

                _db.Incomes.Add(new Income
                {
                    Amount = totalBudget,
                    Date = nextDate,
                    Type = item.IncomeType ?? "Paycheck",
                    Description = item.Description,
                    RecurringItemId = item.Id,
                });
                created++;

                nextDate = NextDueDate(nextDate, item.Frequency);
            }

            item.LastAppliedDate = lastGenerated;
        }

        if (created > 0)
            await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Apply all active non-system recurring items up to the given date.
    /// Returns the count of records created.
    /// </summary>
    public async Task<int> ApplyRecurringItems(DateTime upToDate)
    {
        var activeItems = await _db.RecurringItems
            .Where(r => r.Active && !r.IsSystem)
            .ToListAsync();

        int created = 0;

        foreach (var item in activeItems)
        {
            DateTime nextDate;
            if (item.LastAppliedDate == null)
                nextDate = item.StartDate.Date;
            else
                nextDate = NextDueDate(item.LastAppliedDate.Value, item.Frequency);

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

    public static DateTime NextDueDate(DateTime current, string frequency)
    {
        return frequency switch
        {
            "Monthly" => current.AddMonths(1),
            "Quarterly" => current.AddMonths(3),
            "Yearly" => current.AddYears(1),
            _ => current.AddDays(14),
        };
    }
}
