namespace Pocketfolio.Api.Entities;

public class Transaction : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int EnvelopeId { get; set; }
    public decimal Amount { get; set; }
    public DateTime Date { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? RecurringItemId { get; set; }

    public List<Attachment> Attachments { get; set; } = new();
    public Envelope Envelope { get; set; } = null!;
    public RecurringItem? RecurringItem { get; set; }
}
