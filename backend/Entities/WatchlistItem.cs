namespace Pocketfolio.Api.Entities;

public class WatchlistItem : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Ticker { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
