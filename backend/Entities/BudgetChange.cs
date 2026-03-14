namespace Pocketfolio.Api.Entities;

public class BudgetChange : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int EnvelopeId { get; set; }
    public decimal BudgetFn { get; set; }
    public int EffectivePeriod { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Envelope Envelope { get; set; } = null!;
}
