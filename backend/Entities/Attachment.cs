namespace Pocketfolio.Api.Entities;

public class Attachment : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string EntityType { get; set; } = "txn";
    public int EntityId { get; set; }
    public int? TransactionId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string BlobName { get; set; } = string.Empty;
    public long Size { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Transaction? Transaction { get; set; }
}
