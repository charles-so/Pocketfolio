namespace Pocketfolio.Api.Entities;

public class BonusAllocation : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int EnvelopeId { get; set; }
    public decimal Amount { get; set; }
    public int Period { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Envelope Envelope { get; set; } = null!;
}
