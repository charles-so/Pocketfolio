namespace Pocketfolio.Api.Entities;

public class RecurringItem : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public int? EnvelopeId { get; set; }
    public Envelope? Envelope { get; set; }
    public string? IncomeType { get; set; }
    public DateTime StartDate { get; set; }
    public string Frequency { get; set; } = "Fortnightly";
    public bool Active { get; set; } = true;
    public DateTime? LastAppliedDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
