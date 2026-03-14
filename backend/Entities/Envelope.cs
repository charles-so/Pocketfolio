namespace Pocketfolio.Api.Entities;

public class Envelope : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public decimal BudgetFn { get; set; }
    public int SortOrder { get; set; }
    public string? Ticker { get; set; }

    public ICollection<Transaction> Transactions { get; set; } = [];
    public ICollection<BudgetChange> BudgetChanges { get; set; } = [];
    public ICollection<BonusAllocation> BonusAllocations { get; set; } = [];
    public ICollection<Trade> Trades { get; set; } = [];
}
