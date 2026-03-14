namespace Pocketfolio.Api.Entities;

public class Income : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public decimal Amount { get; set; }
    public DateTime Date { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? RecurringItemId { get; set; }
    public RecurringItem? RecurringItem { get; set; }
}
