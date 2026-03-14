namespace Pocketfolio.Api.Entities;

public class Trade : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int EnvelopeId { get; set; }
    public int HoldingId { get; set; }
    public DateTime Date { get; set; }
    public decimal Shares { get; set; }
    public decimal Price { get; set; }
    public decimal Fees { get; set; }
    public decimal TotalCost { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Envelope Envelope { get; set; } = null!;
    public PortfolioHolding Holding { get; set; } = null!;
}
