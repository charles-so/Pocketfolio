namespace Pocketfolio.Api.Entities;

public class PortfolioHolding : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Ticker { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Shares { get; set; }
    public decimal CostBasis { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Trade> Trades { get; set; } = [];
}
