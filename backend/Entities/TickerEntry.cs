namespace Pocketfolio.Api.Entities;

public class TickerEntry : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Ticker { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Exchange { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
